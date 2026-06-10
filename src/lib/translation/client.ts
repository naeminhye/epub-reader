/**
 * Translation client — two paths:
 *
 *  1. User has their own API key stored in settings
 *     → Call the provider (Gemini / OpenRouter) DIRECTLY from the browser
 *     → Key never leaves the browser, never sent to our worker
 *
 *  2. No user key
 *     → Call our Cloudflare Worker, which uses its own server-side secret
 *
 * This ensures user API keys are never transmitted over the network.
 */

import { db } from '@/lib/db/schema';
import { loadTranslationSettings } from './settings';

export interface TranslationRequest {
    text: string;
    sourceLang?: string;
    targetLang?: string;
    bookId?: string;
}

export interface TranslationResult {
    translation: string;
    cached: boolean;
    model?: string;
    provider?: string;
}

export type TranslationErrorCode =
    | 'invalid_key'
    | 'rate_limited'
    | 'key_blocked'
    | 'network'
    | 'all_models_failed'
    | 'unknown';

export class TranslationError extends Error {
    public status: number;
    public detail?: string;
    public code: TranslationErrorCode;
    public isRateLimited: boolean;
    public retryAfterSeconds?: number;
    public allModelsFailed: boolean;

    constructor(message: string, status: number, detail?: string) {
        super(message);
        this.name = 'TranslationError';
        this.status = status;
        this.detail = detail;
        this.allModelsFailed = false;
        this.isRateLimited = status === 429;
        this.code = deriveErrorCode(message, status);
    }
}

function deriveErrorCode(message: string, status: number): TranslationErrorCode {
    const msg = message.toLowerCase();
    if (status === 401 || msg.includes('invalid key') || msg.includes('api_key_invalid')) return 'invalid_key';
    if (status === 429 || msg.includes('too many') || msg.includes('rate limit')) return 'rate_limited';
    if (status === 403 || msg.includes('blocked') || msg.includes('key blocked')) return 'key_blocked';
    if (status === 0 || msg.includes('network') || msg.includes('reach') || msg.includes('failed to fetch')) return 'network';
    if (msg.includes('all models')) return 'all_models_failed';
    return 'unknown';
}

export const rateLimitState = {
    isLimited: false,
    retryAfter: null as Date | null,
    set(retryAfterSeconds?: number) {
        this.isLimited = true;
        this.retryAfter = retryAfterSeconds
            ? new Date(Date.now() + retryAfterSeconds * 1000)
            : new Date(Date.now() + 60_000);
    },
    clear() { this.isLimited = false; this.retryAfter = null; },
    secondsRemaining(): number {
        if (!this.isLimited || !this.retryAfter) return 0;
        const remaining = Math.ceil((this.retryAfter.getTime() - Date.now()) / 1000);
        if (remaining <= 0) { this.clear(); return 0; }
        return remaining;
    },
};

const API_URL = import.meta.env.VITE_TRANSLATION_API_URL as string | undefined;

export async function translate(req: TranslationRequest): Promise<TranslationResult> {
    const targetLang = req.targetLang ?? 'vi';
    const sourceLang = req.sourceLang ?? 'auto';
    const text = req.text.trim();

    if (!text) throw new TranslationError('Empty text', 400);

    const remaining = rateLimitState.secondsRemaining();
    if (remaining > 0) {
        const err = new TranslationError(`Too many requests. Try again in ${remaining}s.`, 429);
        err.retryAfterSeconds = remaining;
        throw err;
    }

    // Cache check — keyed on text + langs only, independent of provider
    const cacheKey = await makeCacheKey(text, sourceLang, targetLang);
    const cached = await db.translations.get(cacheKey);
    if (cached) return { translation: cached.translatedText, cached: true };

    const settings = loadTranslationSettings();

    let result: TranslationResult;

    switch (settings.provider) {
        case 'gemini': {
            const key = settings.geminiApiKey.trim();
            if (key) {
                result = await callGeminiDirect(text, sourceLang, targetLang, settings.geminiModel, key);
            } else {
                result = await callWorker(text, sourceLang, targetLang, settings, requireApiUrl());
            }
            break;
        }
        case 'openrouter': {
            const key = settings.openrouterApiKey.trim();
            if (!key) throw new TranslationError('Invalid Key', 401);
            result = await callOpenRouterDirect(text, sourceLang, targetLang, settings.openrouterModel, key);
            break;
        }
        case 'deepl': {
            const key = settings.deeplApiKey.trim();
            if (!key) throw new TranslationError('Invalid Key', 401);
            result = await callDeepL(text, sourceLang, targetLang, key);
            break;
        }
        case 'google-translate': {
            result = await callGoogleTranslate(text, sourceLang, targetLang, settings.googleTranslateApiKey.trim());
            break;
        }
        case 'papago': {
            const clientId = settings.papagoClientId.trim();
            const secret = settings.papagoClientSecret.trim();
            if (!clientId || !secret) throw new TranslationError('Invalid Key', 401);
            result = await callPapago(text, sourceLang, targetLang, clientId, secret);
            break;
        }
        case 'deeplx': {
            const url = settings.deeplxUrl.trim();
            if (!url) throw new TranslationError('Invalid Key', 401);
            result = await callDeepLX(text, sourceLang, targetLang, url);
            break;
        }
        case 'browser': {
            result = await callBrowserTranslator(text, sourceLang, targetLang);
            break;
        }
        default:
            throw new TranslationError('Unknown provider', 500);
    }

    // Cache the result
    db.translations.put({
        key: cacheKey,
        sourceText: text,
        translatedText: result.translation,
        sourceLang,
        targetLang,
        bookId: req.bookId,
        createdAt: new Date(),
    }).catch((err) => console.warn('Failed to cache translation:', err));

    return result;
}

// ---------------------------------------------------------------------------
// Path 1a: Gemini direct (browser → Google, user key only)
// ---------------------------------------------------------------------------
async function callGeminiDirect(
    text: string,
    sourceLang: string,
    targetLang: string,
    modelKey: string,
    apiKey: string
): Promise<TranslationResult> {
    const modelName = GEMINI_MODEL_NAMES[modelKey] ?? modelKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildPrompt(text, sourceLang, targetLang) }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
            }),
        });
    } catch (err) {
        throw new TranslationError('Could not reach Gemini. Check your connection.', 0, String(err));
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = extractGeminiError(body, res.status);
        const error = new TranslationError(msg, res.status);
        if (res.status === 429) {
            const retryAfter = parseRetryAfter(res, body);
            error.retryAfterSeconds = retryAfter;
            rateLimitState.set(retryAfter);
        }
        throw error;
    }

    const data = await res.json() as Record<string, unknown>;
    const translation = extractGeminiText(data);
    if (!translation) throw new TranslationError('Empty response from Gemini', 502);

    return { translation, cached: false, model: modelName, provider: 'gemini' };
}

// ---------------------------------------------------------------------------
// Path 1b: OpenRouter direct (browser → OpenRouter, user key only)
// ---------------------------------------------------------------------------
async function callOpenRouterDirect(
    text: string,
    sourceLang: string,
    targetLang: string,
    model: string,
    apiKey: string
): Promise<TranslationResult> {
    let res: Response;
    try {
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://aurobie.app',
                'X-Title': 'Aurobie',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: buildPrompt(text, sourceLang, targetLang) }],
                temperature: 0.2,
                max_tokens: 4096,
            }),
        });
    } catch (err) {
        throw new TranslationError('Could not reach OpenRouter. Check your connection.', 0, String(err));
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = (body.error as Record<string, unknown> | undefined)?.message as string
            ?? `Translation failed (${res.status})`;
        const error = new TranslationError(mapProviderError(msg, res.status), res.status);
        if (res.status === 429) {
            const retryAfter = parseRetryAfter(res, body);
            error.retryAfterSeconds = retryAfter;
            rateLimitState.set(retryAfter);
        }
        throw error;
    }

    const data = await res.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    const translation = choices?.[0]?.message?.content?.trim();
    if (!translation) throw new TranslationError('Empty response from OpenRouter', 502);

    return { translation, cached: false, model, provider: 'openrouter' };
}

// ---------------------------------------------------------------------------
// Path 2: Via worker (browser → our worker → provider, server key)
// ---------------------------------------------------------------------------
async function callWorker(
    text: string,
    sourceLang: string,
    targetLang: string,
    settings: ReturnType<typeof loadTranslationSettings>,
    apiUrl: string
): Promise<TranslationResult> {
    let res: Response;
    try {
        res = await fetch(`${apiUrl}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // No API key sent — worker uses its own env secret
            body: JSON.stringify({
                text,
                sourceLang,
                targetLang,
                provider: settings.provider,
                model: settings.provider === 'gemini' ? settings.geminiModel : settings.openrouterModel,
            }),
        });
    } catch (err) {
        throw new TranslationError('Could not reach translation service. Check your connection.', 0, String(err));
    }

    if (!res.ok) {
        let errMessage = `Translation failed (${res.status})`;
        let detail: string | undefined;
        let allModelsFailed = false;
        let retryAfterSeconds: number | undefined;

        try {
            const body = await res.json() as Record<string, unknown>;
            errMessage = (body.error as string) ?? errMessage;
            detail = body.detail as string | undefined;
            allModelsFailed = body.allModelsFailed === true;
        } catch { /* ignore */ }

        if (res.status === 429) {
            const retryHeader = res.headers.get('Retry-After');
            retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) : undefined;
            if (retryAfterSeconds !== undefined && isNaN(retryAfterSeconds)) retryAfterSeconds = undefined;
            rateLimitState.set(retryAfterSeconds);
        }

        const error = new TranslationError(errMessage, res.status, detail);
        if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
        error.allModelsFailed = allModelsFailed;
        throw error;
    }

    const data = await res.json() as { translation?: string; model?: string; provider?: string };
    const translation = data.translation?.trim();
    if (!translation) throw new TranslationError('Empty translation returned', 502);

    return { translation, cached: false, model: data.model, provider: data.provider };
}

// ---------------------------------------------------------------------------
// Shared prompt builder
// ---------------------------------------------------------------------------
const LANG_NAMES: Record<string, string> = {
    vi: 'Vietnamese', en: 'English', ko: 'Korean',
    zh: 'Simplified Chinese', ja: 'Japanese',
    fr: 'French', de: 'German', es: 'Spanish',
};

function buildPrompt(text: string, sourceLang: string, targetLang: string): string {
    const target = LANG_NAMES[targetLang] ?? targetLang;
    const sourceHint = (sourceLang && sourceLang !== 'auto' && LANG_NAMES[sourceLang])
        ? ` from ${LANG_NAMES[sourceLang]}` : '';

    return `You are a professional literary book translator${sourceHint ? ' translating' + sourceHint : ''}.
Translate the following text to ${target}.

Rules:
- Output ONLY the translated text. No preamble, no explanations.
- Preserve all whitespace, line breaks, and paragraph structure exactly.
- Keep proper names in original form unless a well-known localized form exists.
- Keep technical terms with no natural equivalent in the original language.
- Match the tone and register of the source (formal/informal, literary/plain).

Text:
${text}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GEMINI_MODEL_NAMES: Record<string, string> = {
    'flash-lite': 'gemini-2.5-flash-lite',
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro',
    'flash-preview': 'gemini-2.5-flash-preview-05-20',
};

function extractGeminiText(data: Record<string, unknown>): string {
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) return '';

    const content = candidates[0].content as Record<string, unknown> | undefined;
    if (!content) return '';

    const parts = content.parts as Array<Record<string, unknown>> | undefined;
    if (!parts || parts.length === 0) return '';

    const text = parts[0].text as string | undefined;
    return text ?? '';
}

function extractGeminiError(body: Record<string, unknown>, status: number): string {
    const err = body.error as Record<string, unknown> | undefined;
    const geminiMsg = (err?.message as string | undefined) ?? '';
    return mapProviderError(geminiMsg, status);
}

function mapProviderError(msg: string, status: number): string {
    if (status === 401 || msg.toLowerCase().includes('api_key_invalid') || msg.toLowerCase().includes('invalid api key')) {
        return 'Invalid Key';
    }
    if (status === 403 || msg.toLowerCase().includes('blocked') || msg.toLowerCase().includes('permission')) {
        return 'Key blocked';
    }
    if (status === 429) return 'Too many requests';
    return msg || `Translation failed (${status})`;
}

function parseRetryAfter(res: Response, body: Record<string, unknown>): number | undefined {
    const header = res.headers.get('Retry-After');
    if (header) {
        const n = parseInt(header, 10);
        if (!isNaN(n)) return n;
    }
    // Gemini sometimes embeds retry delay in the error body
    const bodyStr = JSON.stringify(body);
    const match = bodyStr.match(/"retryDelay"\s*:\s*"(\d+)s"/);
    if (match) return parseInt(match[1], 10);
    return undefined;
}

async function makeCacheKey(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const input = `${sourceLang}::${targetLang}::${text}`;
    const buf = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).slice(0, 12)
        .map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkHealth(): Promise<boolean> {
    if (!API_URL) return false;
    try {
        const res = await fetch(`${API_URL}/health`);
        return res.ok && (await res.json() as { ok?: boolean }).ok === true;
    } catch { return false; }
}

function requireApiUrl(): string {
    if (!API_URL) throw new TranslationError(
        'Translation API URL not configured. Set VITE_TRANSLATION_API_URL in .env.local', 500
    );
    return API_URL;
}

// ---------------------------------------------------------------------------
// DeepL direct
// ---------------------------------------------------------------------------
async function callDeepL(
    text: string, sourceLang: string, targetLang: string, apiKey: string
): Promise<TranslationResult> {
    const baseUrl = apiKey.endsWith(':fx')
        ? 'https://api-free.deepl.com/v2'
        : 'https://api.deepl.com/v2';
    const tgt = DEEPL_LANG_MAP[targetLang] ?? targetLang.toUpperCase();
    const src = (sourceLang && sourceLang !== 'auto') ? (DEEPL_LANG_MAP[sourceLang] ?? sourceLang.toUpperCase()) : undefined;

    let res: Response;
    try {
        res = await fetch(`${baseUrl}/translate`, {
            method: 'POST',
            headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: [text], target_lang: tgt, ...(src ? { source_lang: src } : {}), preserve_formatting: true }),
        });
    } catch (err) { throw new TranslationError('Could not reach DeepL.', 0, String(err)); }

    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new TranslationError(mapProviderError((body.message as string) ?? '', res.status), res.status);
    }
    const data = await res.json() as { translations?: Array<{ text: string }> };
    const translation = data.translations?.[0]?.text?.trim();
    if (!translation) throw new TranslationError('Empty response from DeepL', 502);
    return { translation, cached: false, model: 'deepl', provider: 'deepl' };
}

const DEEPL_LANG_MAP: Record<string, string> = {
    en: 'EN-US', vi: 'VI', ko: 'KO', zh: 'ZH-HANS',
    ja: 'JA', fr: 'FR', de: 'DE', es: 'ES', it: 'IT',
    pt: 'PT-BR', nl: 'NL', pl: 'PL', ru: 'RU',
};

// ---------------------------------------------------------------------------
// Google Translate direct (official Cloud v2 or unofficial free endpoint)
// ---------------------------------------------------------------------------
async function callGoogleTranslate(
    text: string, sourceLang: string, targetLang: string, apiKey: string
): Promise<TranslationResult> {
    const target = targetLang || 'vi';
    const source = (sourceLang && sourceLang !== 'auto') ? sourceLang : undefined;

    let res: Response;
    if (apiKey) {
        try {
            res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: text, target, ...(source ? { source } : {}), format: 'text' }),
            });
        } catch (err) { throw new TranslationError('Could not reach Google Translate.', 0, String(err)); }

        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as Record<string, unknown>;
            const msg = ((body.error as Record<string, unknown> | undefined)?.message as string) ?? '';
            throw new TranslationError(mapProviderError(msg, res.status), res.status);
        }
        const data = await res.json() as { data?: { translations?: Array<{ translatedText: string }> } };
        const translation = data.data?.translations?.[0]?.translatedText?.trim();
        if (!translation) throw new TranslationError('Empty response from Google Translate', 502);
        return { translation, cached: false, model: 'google-translate', provider: 'google-translate' };

    } else {
        // Unofficial free endpoint
        const params = new URLSearchParams({ client: 'gtx', sl: source ?? 'auto', tl: target, dt: 't', q: text });
        try {
            res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
        } catch (err) { throw new TranslationError('Could not reach Google Translate.', 0, String(err)); }

        if (!res.ok) throw new TranslationError(`Google Translate error (${res.status})`, res.status);
        const data = await res.json() as unknown[][];
        const parts = (data[0] as unknown[][]).map(item => (item[0] as string) ?? '');
        const translation = parts.join('').trim();
        if (!translation) throw new TranslationError('Empty response from Google Translate', 502);
        return { translation, cached: false, model: 'google-translate', provider: 'google-translate' };
    }
}

// ---------------------------------------------------------------------------
// Papago (Naver) — note: CORS may block direct browser calls in production
// ---------------------------------------------------------------------------
async function callPapago(
    text: string, sourceLang: string, targetLang: string,
    clientId: string, clientSecret: string
): Promise<TranslationResult> {
    const src = PAPAGO_LANG_MAP[sourceLang] ?? (sourceLang === 'auto' ? 'auto' : sourceLang);
    const tgt = PAPAGO_LANG_MAP[targetLang] ?? targetLang;

    let res: Response;
    try {
        res = await fetch('https://openapi.naver.com/v1/papago/n2mt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
            },
            body: new URLSearchParams({ source: src, target: tgt, text }).toString(),
        });
    } catch (err) { throw new TranslationError('Could not reach Papago.', 0, String(err)); }

    if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new TranslationError(mapProviderError((json.errorMessage as string) ?? '', res.status), res.status);
    }
    const data = await res.json() as { message?: { result?: { translatedText?: string } } };
    const translation = data.message?.result?.translatedText?.trim();
    if (!translation) throw new TranslationError('Empty response from Papago', 502);
    return { translation, cached: false, model: 'papago', provider: 'papago' };
}

// ---------------------------------------------------------------------------
// Browser built-in Translator API (Chrome 138+) — on-device, free, offline
// ---------------------------------------------------------------------------
interface BrowserTranslatorInstance {
    translate(text: string): Promise<string>;
}
interface BrowserTranslatorStatic {
    availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
    create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslatorInstance>;
}

// Translator instances are expensive to create (may download a language pack),
// so cache one per language pair for the session.
const browserTranslators = new Map<string, Promise<BrowserTranslatorInstance>>();

async function detectLanguage(text: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LanguageDetector = (self as any).LanguageDetector as
        | { create(): Promise<{ detect(t: string): Promise<Array<{ detectedLanguage: string; confidence: number }>> }> }
        | undefined;
    if (!LanguageDetector) return 'en';
    try {
        const detector = await LanguageDetector.create();
        const results = await detector.detect(text.slice(0, 1000));
        return results?.[0]?.detectedLanguage ?? 'en';
    } catch {
        return 'en';
    }
}

async function callBrowserTranslator(
    text: string, sourceLang: string, targetLang: string
): Promise<TranslationResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Translator = (self as any).Translator as BrowserTranslatorStatic | undefined;
    if (!Translator) {
        throw new TranslationError(
            'Browser translation is not supported here. Use Chrome 138+ (or Edge), or choose another provider.', 501
        );
    }

    const src = (sourceLang && sourceLang !== 'auto') ? sourceLang : await detectLanguage(text);
    if (src === targetLang) {
        return { translation: text, cached: false, model: 'browser', provider: 'browser' };
    }

    const pairKey = `${src}->${targetLang}`;
    let pending = browserTranslators.get(pairKey);
    if (!pending) {
        pending = (async () => {
            const availability = await Translator.availability({ sourceLanguage: src, targetLanguage: targetLang });
            if (availability === 'unavailable') {
                throw new TranslationError(
                    `Your browser cannot translate ${src} → ${targetLang}. Try another provider.`, 501
                );
            }
            // 'downloadable'/'downloading': create() triggers/awaits the language pack download
            return Translator.create({ sourceLanguage: src, targetLanguage: targetLang });
        })();
        browserTranslators.set(pairKey, pending);
    }

    let translator: BrowserTranslatorInstance;
    try {
        translator = await pending;
    } catch (err) {
        browserTranslators.delete(pairKey);
        if (err instanceof TranslationError) throw err;
        throw new TranslationError('Browser translator failed to initialize.', 500, String(err));
    }

    let translation: string;
    try {
        translation = (await translator.translate(text)).trim();
    } catch (err) {
        throw new TranslationError('Browser translation failed.', 500, String(err));
    }
    if (!translation) throw new TranslationError('Empty response from browser translator', 502);

    return { translation, cached: false, model: 'browser', provider: 'browser' };
}

const PAPAGO_LANG_MAP: Record<string, string> = {
    en: 'en', ko: 'ko', zh: 'zh-CN', ja: 'ja',
    vi: 'vi', fr: 'fr', es: 'es', de: 'de', it: 'it',
    pt: 'pt', ru: 'ru', th: 'th', id: 'id',
};

// ---------------------------------------------------------------------------
// DeepLX (self-hosted proxy)
// ---------------------------------------------------------------------------
async function callDeepLX(
    text: string, sourceLang: string, targetLang: string, serverUrl: string
): Promise<TranslationResult> {
    const url = serverUrl.replace(/\/$/, '') + '/translate';
    const src = (sourceLang && sourceLang !== 'auto') ? sourceLang.toUpperCase() : 'auto';
    const tgt = DEEPL_LANG_MAP[targetLang] ?? targetLang.toUpperCase();

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, source_lang: src, target_lang: tgt }),
        });
    } catch (err) { throw new TranslationError(`Could not reach DeepLX at ${serverUrl}.`, 0, String(err)); }

    if (!res.ok) throw new TranslationError(`DeepLX error (${res.status})`, res.status);
    const data = await res.json() as { data?: string };
    const translation = data.data?.trim();
    if (!translation) throw new TranslationError('Empty response from DeepLX', 502);
    return { translation, cached: false, model: 'deeplx', provider: 'deeplx' };
}