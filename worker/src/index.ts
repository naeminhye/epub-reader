/**
 * Cloudflare Worker: Gemini Translation Proxy
 *
 * Endpoints:
 *  POST /translate
 *    body: { text: string, sourceLang?: string, targetLang?: string, model?: ModelKey }
 *    returns: { translation: string, model: string, cached: false, fallbackUsed?: boolean }
 *
 *  GET /health
 *    returns: { ok: true }
 */

interface Env {
    GEMINI_API_KEY: string;
    RATE_LIMIT?: KVNamespace;
    ALLOWED_ORIGINS?: string;
}

type ModelKey = 'flash-lite' | 'flash' | 'pro' | 'flash-preview' | 'flash-lite-preview';

const MODEL_MAP: Record<ModelKey, string> = {
    'flash-lite': 'gemini-2.5-flash-lite',
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro',
    'flash-preview': 'gemini-2.5-flash-preview-05-20',
    'flash-lite-preview': 'gemini-2.5-flash-lite-preview-06-17',
};

const RATE_LIMIT_PER_HOUR = 200;
const MAX_TEXT_LENGTH = 5000;

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return corsResponse(null, 204, env, request);
        if (request.method === 'GET' && url.pathname === '/health') return corsResponse({ ok: true }, 200, env, request);
        if (request.method === 'POST' && url.pathname === '/translate') return handleTranslate(request, env);
        return corsResponse({ error: 'Not found' }, 404, env, request);
    },
};

async function handleTranslate(request: Request, env: Env): Promise<Response> {
    // Rate limiting
    if (env.RATE_LIMIT) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const rateKey = `rl:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
        const current = parseInt((await env.RATE_LIMIT.get(rateKey)) ?? '0', 10);
        if (current >= RATE_LIMIT_PER_HOUR) {
            return corsResponse({ error: 'Rate limit exceeded. Try again later.' }, 429, env, request, {
                'Retry-After': '60',
            });
        }
        await env.RATE_LIMIT.put(rateKey, String(current + 1), { expirationTtl: 3700 });
    }

    // Parse body
    let body: { text?: string; sourceLang?: string; targetLang?: string; model?: ModelKey };
    try {
        body = await request.json();
    } catch {
        return corsResponse({ error: 'Invalid JSON body' }, 400, env, request);
    }

    const text = body.text?.trim();
    if (!text) return corsResponse({ error: 'Missing text' }, 400, env, request);
    if (text.length > MAX_TEXT_LENGTH) return corsResponse({ error: 'Text exceeds limit' }, 400, env, request);

    // Model fallback queue
    const requestedModel: ModelKey = body.model ?? 'flash-lite';
    const allModels: ModelKey[] = ['flash-lite', 'flash', 'flash-preview', 'flash-lite-preview', 'pro'];
    const fallbackQueue = [requestedModel, ...allModels.filter(m => m !== requestedModel)];

    let lastStatus = 502;
    let lastError = '';

    for (const modelKey of fallbackQueue) {
        const modelName = MODEL_MAP[modelKey];
        try {
            const { translation, status } = await callGeminiAPI(
                text, body.sourceLang, body.targetLang, modelName, env
            );
            return corsResponse({
                translation,
                model: modelName,
                cached: false,
                fallbackUsed: modelKey !== requestedModel,
            }, 200, env, request);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            lastError = msg;
            // Extract status if embedded in message
            const statusMatch = msg.match(/HTTP (\d+)/);
            if (statusMatch) lastStatus = parseInt(statusMatch[1], 10);

            // Don't fallback on 429 from Gemini — all models share quota
            if (lastStatus === 429) {
                // Parse retry delay from Gemini error body if available
                const retryMatch = msg.match(/(\d+)s/);
                const retryAfter = retryMatch ? retryMatch[1] : '60';
                return corsResponse(
                    { error: 'Rate limit reached. Try again later.', detail: msg },
                    429, env, request,
                    { 'Retry-After': retryAfter }
                );
            }

            continue;
        }
    }

    // All models failed
    const finalStatus = lastStatus === 403 ? 403 : 502;
    return corsResponse(
        { error: 'All translation models failed.', detail: lastError, allModelsFailed: true },
        finalStatus, env, request
    );
}

async function callGeminiAPI(
    text: string,
    source: string | undefined,
    target: string | undefined,
    modelName: string,
    env: Env
): Promise<{ translation: string; status: number }> {
    const langNames: Record<string, string> = {
        vi: 'natural Vietnamese',
        en: 'English',
        ko: 'natural Korean',
        zh: 'Simplified Chinese',
        ja: 'natural Japanese',
        fr: 'French',
        de: 'German',
        es: 'Spanish',
    };
    const targetLangName = (target && langNames[target]) ? langNames[target] : (target ?? 'natural Vietnamese');
    const sourceHint = (source && source !== 'auto') ? ` (source: ${source})` : '';

    const prompt = `Translate to ${targetLangName}${sourceHint}.
Rules: Output ONLY the translation. No commentary. Preserve formatting and line breaks.
Text: ${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: Math.min(2048, text.length * 4),
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json<any>();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) throw new Error('Empty response from Gemini');

    return { translation: result, status: res.status };
}

function corsResponse(
    data: unknown,
    status: number,
    env: Env,
    request: Request,
    extraHeaders?: Record<string, string>
): Response {
    const origin = request.headers.get('origin') ?? '*';
    const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map(s => s.trim());
    const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin : (allowed[0] ?? '*');

    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
        ...extraHeaders,
    };

    if (data === null) return new Response(null, { status, headers });

    headers['Content-Type'] = 'application/json';
    return new Response(JSON.stringify(data), { status, headers });
}