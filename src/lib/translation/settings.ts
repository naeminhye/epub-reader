/**
 * Translation settings — stored in localStorage.
 * API keys never go to Dexie (IndexedDB is inspectable).
 *
 * Provider categories:
 *   'llm'    — Large language model (prompt-based, best quality, slower)
 *   'neural' — Dedicated neural translation (purpose-built, fast, accurate for common langs)
 */

export type TranslationProvider =
    | 'gemini'           // LLM — Google Gemini via AI Studio
    | 'openrouter'       // LLM — Multi-model gateway (Claude, GPT-4, Llama, etc.)
    | 'deepl'            // Neural — DeepL (highest quality for EU/JP langs, paid)
    | 'google-translate' // Neural — Google Translate (free unofficial + paid Cloud)
    | 'papago'           // Neural — Naver Papago (best for Korean ↔ others)
    | 'deeplx'           // Neural — DeepLX (self-hosted DeepL proxy, free)
    | 'browser';         // Neural — Browser built-in Translator API (on-device, free, offline)

export type ProviderCategory = 'llm' | 'neural' | 'browser';

export interface ProviderMeta {
    id: TranslationProvider;
    name: string;
    category: ProviderCategory;
    tagline: string;
    keyHint: string;
    keyUrl?: string;
    keyRequired: boolean;   // false = can work without user key (uses server key / free tier)
    supportsModels: boolean;
    note?: string;
}

export const PROVIDERS: ProviderMeta[] = [
    {
        id: 'gemini',
        name: 'Gemini',
        category: 'llm',
        tagline: 'Google AI — best for literary nuance',
        keyHint: 'AIza…',
        keyUrl: 'https://aistudio.google.com/apikey',
        keyRequired: false,
        supportsModels: true,
        note: 'Free tier: 15 req/min, 1,000 req/day. Understands context and tone.',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        category: 'llm',
        tagline: 'Claude, GPT-4, Llama and 200+ models',
        keyHint: 'sk-or-…',
        keyUrl: 'https://openrouter.ai/keys',
        keyRequired: true,
        supportsModels: true,
        note: 'Bring your own key. Free models available (Llama 3.1 8B, etc.).',
    },
    {
        id: 'deepl',
        name: 'DeepL',
        category: 'neural',
        tagline: 'Highest accuracy for European languages',
        keyHint: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx',
        keyUrl: 'https://www.deepl.com/pro-api',
        keyRequired: true,
        supportsModels: false,
        note: 'Free tier: 500,000 chars/month. Best for EN↔DE/FR/ES/IT/PT/NL/PL/JA/ZH.',
    },
    {
        id: 'google-translate',
        name: 'Google Translate',
        category: 'neural',
        tagline: 'Fast, 100+ languages, widely known',
        keyHint: 'AIza… (Cloud Translation API key)',
        keyUrl: 'https://console.cloud.google.com/apis/library/translate.googleapis.com',
        keyRequired: false,
        supportsModels: false,
        note: 'Uses unofficial API (no key needed) or official Cloud Translation v2 with your key.',
    },
    {
        id: 'papago',
        name: 'Papago',
        category: 'neural',
        tagline: 'Naver — best for Korean translations',
        keyHint: 'Client ID (from Naver Developers)',
        keyUrl: 'https://developers.naver.com/apps/#/register',
        keyRequired: true,
        supportsModels: false,
        note: 'Requires both Client ID and Client Secret. Best for KO↔EN/ZH/JA/VI/FR.',
    },
    {
        id: 'deeplx',
        name: 'DeepLX',
        category: 'neural',
        tagline: 'Self-hosted DeepL proxy — unlimited & free',
        keyHint: 'http://localhost:1188',
        keyRequired: true,
        supportsModels: false,
        note: 'Run your own DeepLX instance. Enter your server URL (no auth key needed by default).',
    },
    {
        id: 'browser',
        name: 'Browser Translation',
        category: 'browser',
        tagline: 'Built-in, on-device — free, private, works offline',
        keyHint: '',
        keyRequired: false,
        supportsModels: false,
        note: 'Uses your browser\'s built-in Translator API (Chrome 138+). Text never leaves your device. Language packs download automatically on first use.',
    },
];

/** True if this browser exposes the built-in Translator API */
export function isBrowserTranslatorSupported(): boolean {
    return typeof self !== 'undefined' && 'Translator' in self;
}

// LLM model options
export const GEMINI_MODELS = [
    { key: 'flash-lite', label: 'Gemini 2.5 Flash-Lite (fastest, free)' },
    { key: 'flash', label: 'Gemini 2.5 Flash' },
    { key: 'flash-preview', label: 'Gemini 2.5 Flash Preview' },
    { key: 'pro', label: 'Gemini 2.5 Pro (best quality)' },
];

export const OPENROUTER_MODELS = [
    { key: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (fast)' },
    { key: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { key: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { key: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { key: 'openai/gpt-4o', label: 'GPT-4o' },
    { key: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
    { key: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (free)' },
    { key: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B (free)' },
];

export interface TranslationSettings {
    provider: TranslationProvider;
    // LLM model selections
    geminiModel: string;
    openrouterModel: string;
    // API keys by provider
    geminiApiKey: string;
    openrouterApiKey: string;
    deeplApiKey: string;
    googleTranslateApiKey: string;  // empty = use unofficial free endpoint
    papagoClientId: string;
    papagoClientSecret: string;
    deeplxUrl: string;              // e.g. http://localhost:1188
}

const STORAGE_KEY = 'aurobie-translation-settings';

export const DEFAULTS: TranslationSettings = {
    provider: 'browser',
    geminiModel: 'flash-lite',
    openrouterModel: 'anthropic/claude-3-haiku',
    geminiApiKey: '',
    openrouterApiKey: '',
    deeplApiKey: '',
    googleTranslateApiKey: '',
    papagoClientId: '',
    papagoClientSecret: '',
    deeplxUrl: 'http://localhost:1188',
};

export function loadTranslationSettings(): TranslationSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<TranslationSettings>) };
    } catch {
        return { ...DEFAULTS };
    }
}

export function saveTranslationSettings(s: Partial<TranslationSettings>): TranslationSettings {
    const next = { ...loadTranslationSettings(), ...s };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
}

export function clearTranslationSettings(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** True if the current provider has all required keys set */
export function isProviderReady(settings: TranslationSettings): boolean {
    switch (settings.provider) {
        case 'gemini': return true; // can use server key
        case 'openrouter': return !!settings.openrouterApiKey;
        case 'deepl': return !!settings.deeplApiKey;
        case 'google-translate': return true; // unofficial free tier always available
        case 'papago': return !!settings.papagoClientId && !!settings.papagoClientSecret;
        case 'deeplx': return !!settings.deeplxUrl;
        case 'browser': return isBrowserTranslatorSupported();
        default: return false;
    }
}