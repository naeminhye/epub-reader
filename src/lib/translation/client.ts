import { db } from '@/lib/db/schema';

export type TranslationModel = 'flash-lite' | 'flash' | 'pro';

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

    constructor(message: string, status: number, detail?: string) {
        super(message);
        this.name = 'TranslationError';
        this.status = status;
        this.detail = detail;
    }
}

const API_URL = import.meta.env.VITE_TRANSLATION_API_URL as string | undefined;

/**
 * Translate text via the Cloudflare Worker proxy.
 * Checks the local cache first; only calls the network on a miss.
 */
export async function translate(req: TranslationRequest): Promise<TranslationResult> {
    const targetLang = req.targetLang ?? 'vi';
    const sourceLang = req.sourceLang ?? 'auto';
    const text = req.text.trim();

    if (!text) {
        throw new TranslationError('Empty text', 400);
    }

    // Cache check
    const cacheKey = await makeCacheKey(text, sourceLang, targetLang);
    const cached = await db.translations.get(cacheKey);
    if (cached) {
        return {
            translation: cached.translatedText,
            cached: true,
        };
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
        try {
            const errBody = await res.json();
            errMessage = errBody.error ?? errMessage;
            detail = errBody.detail;
        } catch {
            // ignore
        }
        throw new TranslationError(errMessage, res.status, detail);
    }

    const data = (await res.json()) as { translation?: string; model?: string };
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