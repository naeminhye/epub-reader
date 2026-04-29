import { db } from '@/lib/db/schema';

export type TranslationModel = 'flash-lite' | 'flash' | 'pro' | 'flash-preview' | 'flash-lite-preview';

export interface TranslationRequest {
    text: string;
    sourceLang?: string;
    targetLang?: string;
    model?: TranslationModel;
    bookId?: string;
}

export interface TranslationResult {
    translation: string;
    cached: boolean;
    model?: string;
}

export class TranslationError extends Error {
    public status: number;
    public detail?: string;
    public isRateLimited: boolean;
    public retryAfterSeconds?: number;
    public allModelsFailed: boolean;

    constructor(message: string, status: number, detail?: string) {
        super(message);
        this.name = 'TranslationError';
        this.status = status;
        this.detail = detail;
        this.isRateLimited = status === 429;
        this.allModelsFailed = false;
    }
}

/**
 * In-memory rate limit state — shared across all translation calls.
 * Resets automatically when retryAfter time passes, or when the user
 * manually re-enables auto-translate.
 */
export const rateLimitState = {
    isLimited: false,
    retryAfter: null as Date | null,

    set(retryAfterSeconds?: number) {
        this.isLimited = true;
        this.retryAfter = retryAfterSeconds
            ? new Date(Date.now() + retryAfterSeconds * 1000)
            : new Date(Date.now() + 60_000); // default 60s if no header
    },

    clear() {
        this.isLimited = false;
        this.retryAfter = null;
    },

    /** Returns seconds remaining, or 0 if expired/not limited */
    secondsRemaining(): number {
        if (!this.isLimited || !this.retryAfter) return 0;
        const remaining = Math.ceil((this.retryAfter.getTime() - Date.now()) / 1000);
        if (remaining <= 0) {
            this.clear();
            return 0;
        }
        return remaining;
    },
};

const API_URL = import.meta.env.VITE_TRANSLATION_API_URL as string | undefined;

/**
 * Translate text via the Cloudflare Worker proxy.
 * Checks the local cache first; only calls the network on a miss.
 * Throws TranslationError with isRateLimited=true on 429.
 */
export async function translate(req: TranslationRequest): Promise<TranslationResult> {
    const targetLang = req.targetLang ?? 'vi';
    const sourceLang = req.sourceLang ?? 'auto';
    const text = req.text.trim();

    if (!text) {
        throw new TranslationError('Empty text', 400);
    }

    // Check in-memory rate limit — don't call the API if we're still cooling down
    const remaining = rateLimitState.secondsRemaining();
    if (remaining > 0) {
        const err = new TranslationError(`Rate limited. Try again in ${remaining}s.`, 429);
        err.retryAfterSeconds = remaining;
        throw err;
    }

    // Cache check
    const cacheKey = await makeCacheKey(text, sourceLang, targetLang);
    const cached = await db.translations.get(cacheKey);
    if (cached) {
        return { translation: cached.translatedText, cached: true };
    }

    // Network call
    if (!API_URL) {
        throw new TranslationError(
            'Translation API URL not configured. Set VITE_TRANSLATION_API_URL in .env.local',
            500
        );
    }

    let res: Response;
    try {
        res = await fetch(`${API_URL}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                sourceLang,
                targetLang,
                model: req.model ?? 'flash-lite',
            }),
        });
    } catch (err) {
        throw new TranslationError(
            'Could not reach translation service. Check your connection.',
            0,
            String(err)
        );
    }

    if (!res.ok) {
        let errMessage = `Translation failed (${res.status})`;
        let detail: string | undefined;
        let retryAfterSeconds: number | undefined;
        let allModelsFailed = false;

        try {
            const errBody = await res.json() as Record<string, unknown>;
            errMessage = (errBody.error as string) ?? errMessage;
            detail = errBody.detail as string | undefined;
            allModelsFailed = errBody.allModelsFailed === true;
        } catch { /* ignore */ }

        if (res.status === 429) {
            const retryHeader = res.headers.get('Retry-After');
            retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) : undefined;
            if (retryAfterSeconds !== undefined && isNaN(retryAfterSeconds)) retryAfterSeconds = undefined;
            rateLimitState.set(retryAfterSeconds);
            const waitMsg = retryAfterSeconds ? ` Try again in ${retryAfterSeconds}s.` : '';
            errMessage = `Rate limit reached.${waitMsg}`;
        }

        const error = new TranslationError(errMessage, res.status, detail);
        if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
        error.allModelsFailed = allModelsFailed;
        throw error;
    }

    const data = (await res.json()) as { translation?: string; model?: string; fallbackUsed?: boolean };
    const translation = data.translation?.trim();

    if (!translation) {
        throw new TranslationError('Empty translation returned', 502);
    }

    // Persist to cache (fire-and-forget; don't block the response)
    db.translations
        .put({
            key: cacheKey,
            sourceText: text,
            translatedText: translation,
            sourceLang,
            targetLang,
            bookId: req.bookId,
            createdAt: new Date(),
        })
        .catch((err) => {
            console.warn('Failed to cache translation:', err);
        });

    return {
        translation,
        cached: false,
        model: data.model,
    };
}

/**
 * Build a stable cache key from text + langs.
 * Uses SHA-256 of the concatenated values, truncated to first 24 hex chars.
 * Collision probability at this length is negligible for a single-user app.
 */
async function makeCacheKey(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const input = `${sourceLang}::${targetLang}::${text}`;
    const buf = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Health check — useful for debugging connectivity issues.
 */
export async function checkHealth(): Promise<boolean> {
    if (!API_URL) return false;
    try {
        const res = await fetch(`${API_URL}/health`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.ok === true;
    } catch {
        return false;
    }
}