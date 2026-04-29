/**
 * Cloudflare Worker: Gemini Translation Proxy
 *
 * Why this exists:
 *  - Gemini API keys cannot be shipped to a browser (extracted in seconds)
 *  - This Worker holds the key as a secret and forwards translation requests
 *  - Adds CORS headers so the browser can call it from any origin
 *  - Adds basic per-IP rate limiting to prevent abuse if the URL leaks
 *
 * Endpoints:
 *  POST /translate
 *    body: { text: string, sourceLang?: string, targetLang?: string, model?: 'flash-lite' | 'flash' | 'pro' | 'flash-preview' | 'flash-lite-preview' }
 *    returns: { translation: string, model: string, cached: false }
 *
 *  GET /health
 *    returns: { ok: true }
 *
 * Deployment:
 *  1. npm install -g wrangler
 *  2. cd worker/ && wrangler login
 *  3. wrangler secret put GEMINI_API_KEY  (paste your key when prompted)
 *  4. wrangler deploy
 *
 * After deploy, copy the Worker URL into your frontend env:
 *  VITE_TRANSLATION_API_URL=https://epub-reader-vi-translate.<your-subdomain>.workers.dev
 */
/**
 * Updates:
 * - Protects Gemini API keys from exposure in client-side code.
 * - Handles CORS for browser-based requests.
 * - Implements rate limiting and automatic model fallback for high availability.
 */

interface Env {
    GEMINI_API_KEY: string;
    // Optional: KV namespace for rate limiting. If not bound, rate limiting is skipped.
    RATE_LIMIT?: KVNamespace;
    // Optional: comma-separated list of allowed origins. Default '*' for dev.
    ALLOWED_ORIGINS?: string;
}

type ModelKey = 'flash-lite' | 'flash' | 'pro' | 'flash-preview' | 'flash-lite-preview';

const MODEL_MAP: Record<ModelKey, string> = {
    'flash-lite': 'gemini-2.5-flash-lite',
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro',
    'flash-preview': 'gemini-3-flash-preview',
    'flash-lite-preview': 'gemini-3-flash-lite-preview',
};

const RATE_LIMIT_PER_HOUR = 200; // per IP — safe ceiling well below Gemini's 1000 RPD
const MAX_TEXT_LENGTH = 5000;    // safety cap on a single translation request

export default {
    /**
     * Main fetch handler for incoming HTTP requests
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return corsResponse(null, 204, env, request);
        }

        // Monitoring endpoint
        if (request.method === 'GET' && url.pathname === '/health') {
            return corsResponse({ ok: true }, 200, env, request);
        }

        // Primary translation logic
        if (request.method === 'POST' && url.pathname === '/translate') {
            return handleTranslate(request, env);
        }

        return corsResponse({ error: 'Not found' }, 404, env, request);
    },
};

async function handleTranslate(request: Request, env: Env): Promise<Response> {
    // 1. Rate Limiting Logic (Requires KV Namespace binding)
    if (env.RATE_LIMIT) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const rateKey = `rl:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
        const current = parseInt((await env.RATE_LIMIT.get(rateKey)) ?? '0', 10);

        if (current >= RATE_LIMIT_PER_HOUR) {
            return corsResponse({ error: 'Rate limit exceeded' }, 429, env, request);
        }
        // Increment usage count with a 1-hour expiration
        await env.RATE_LIMIT.put(rateKey, String(current + 1), { expirationTtl: 3700 });
    }

    // 2. Request Validation
    let body: { text?: string; sourceLang?: string; targetLang?: string; model?: ModelKey };
    try {
        body = await request.json();
    } catch {
        return corsResponse({ error: 'Invalid JSON body' }, 400, env, request);
    }

    const text = body.text?.trim();
    if (!text) return corsResponse({ error: 'Missing text' }, 400, env, request);
    if (text.length > MAX_TEXT_LENGTH) return corsResponse({ error: 'Text exceeds limit' }, 400, env, request);

    // 3. Fallback Mechanism Strategy
    // Initialize a queue starting with the requested model followed by others as backups
    const requestedModel = body.model ?? 'flash-lite';
    const allModels: ModelKey[] = ['flash-lite', 'flash', 'pro', 'flash-preview', 'flash-lite-preview'];
    const fallbackQueue = [requestedModel, ...allModels.filter(m => m !== requestedModel)];

    let lastError = '';

    // Iterate through models until a successful translation is achieved
    for (const modelKey of fallbackQueue) {
        const modelName = MODEL_MAP[modelKey];
        try {
            const translation = await callGeminiAPI(text, body.sourceLang, body.targetLang, modelName, env);

            return corsResponse({
                translation,
                model: modelName,
                fallbackUsed: modelKey !== requestedModel
            }, 200, env, request);

        } catch (err: any) {
            console.error(`Error with ${modelName}: ${err.message}`);
            lastError = err.message;
            continue; // Proceed to the next model in the queue
        }
    }

    // Check if the final error is due to a leaked key (403), if so, return 403.
    const finalStatus = lastError.includes('403') ? 403 : 502;

    return corsResponse({
        error: 'Translation failed',
        detail: lastError
    }, finalStatus, env, request);

    // return corsResponse({ error: 'All models failed', detail: lastError }, 502, env, request);
}

/**
 * Communicates with Google's Gemini API
 * @throws Error if the API returns a non-200 status or empty content
 */
async function callGeminiAPI(text: string, source: string | undefined, target: string | undefined, modelName: string, env: Env): Promise<string> {
    const targetLangName = (target === 'vi' || !target) ? 'natural Vietnamese' : target;
    const sourceHint = (source === 'auto' || !source) ? '' : ` (source language: ${source})`;

    const prompt = `Translate to ${targetLangName}${sourceHint}. 
Rules: Return ONLY the translation, no commentary, preserve formatting.
Text: ${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: Math.min(2048, text.length * 4) },
        }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json<any>();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!result) throw new Error('Empty response');
    return result;
}

/**
 * Helper to generate standardized JSON responses with CORS headers
 */
function corsResponse(data: any, status: number, env: Env, request: Request): Response {
    const origin = request.headers.get('origin') ?? '*';
    const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map(s => s.trim());
    const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin : allowed[0];

    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    if (data === null) return new Response(null, { status, headers });

    headers['Content-Type'] = 'application/json';
    return new Response(JSON.stringify(data), { status, headers });
}