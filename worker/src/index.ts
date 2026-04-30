/**
 * Aurobie Translation Worker
 *
 * Supports: Gemini (Google) and OpenRouter
 *
 * POST /translate
 *   body: {
 *     text: string,
 *     sourceLang?: string,
 *     targetLang?: string,
 *     provider?: 'gemini' | 'openrouter',
 *     model?: string,
 *  *   }
 *   returns: { translation: string, model: string, provider: string, cached: false }
 *
 * GET /health → { ok: true }
 */

interface Env {
    GEMINI_API_KEY: string;
    OPENROUTER_API_KEY?: string;
    RATE_LIMIT?: KVNamespace;
    ALLOWED_ORIGINS?: string;
}

type GeminiModelKey = 'flash-lite' | 'flash' | 'pro' | 'flash-preview';
type Provider = 'gemini' | 'openrouter';

const GEMINI_MODEL_MAP: Record<GeminiModelKey, string> = {
    'flash-lite': 'gemini-2.5-flash-lite',
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro',
    'flash-preview': 'gemini-2.5-flash-preview-05-20',
};
const GEMINI_FALLBACK: GeminiModelKey[] = ['flash-lite', 'flash', 'flash-preview', 'pro'];

const RATE_LIMIT_PER_HOUR = 200;
const MAX_TEXT_LENGTH = 8000;

// Language code → full name for the translation prompt
const LANG_NAMES: Record<string, string> = {
    vi: 'Vietnamese', en: 'English', ko: 'Korean',
    zh: 'Simplified Chinese', ja: 'Japanese',
    fr: 'French', de: 'German', es: 'Spanish',
};

/**
 * Book translator prompt — instructs the model to behave like a professional
 * literary translator, not a generic text transformer.
 */
function buildPrompt(text: string, sourceLang: string | undefined, targetLang: string | undefined): string {
    const target = (targetLang && LANG_NAMES[targetLang]) ?? targetLang ?? 'Vietnamese';
    const sourceHint = (sourceLang && sourceLang !== 'auto' && LANG_NAMES[sourceLang])
        ? ` from ${LANG_NAMES[sourceLang]}`
        : '';

    return `You are a professional literary book translator${sourceHint ? ' translating' + sourceHint : ''}.
Your task: translate the following text to ${target}.

Rules (follow strictly):
- Output ONLY the translated text. No preamble, no "Here is the translation", no explanations.
- Preserve ALL original whitespace, line breaks, and paragraph structure exactly.
- Preserve all punctuation style (em-dashes, ellipses, quotation marks adapted to target language conventions).
- For proper names (people, places, brands): keep the original name unless a well-established localized form exists.
- For technical or domain-specific terms with no natural equivalent: keep the original term.
- Match the tone and register of the source text (formal/informal, literary/plain).

Text to translate:
${text}`;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return cors(null, 204, env, request);
        if (request.method === 'GET' && url.pathname === '/health') return cors({ ok: true }, 200, env, request);
        if (request.method === 'POST' && url.pathname === '/translate') return handleTranslate(request, env);
        return cors({ error: 'Not found' }, 404, env, request);
    },
};

async function handleTranslate(request: Request, env: Env): Promise<Response> {
    let body: {
        text?: string;
        sourceLang?: string;
        targetLang?: string;
        provider?: Provider;
        model?: string;
        // Note: no userApiKey — when user has their own key, the frontend calls
        // the provider directly and never reaches this worker.
    };

    try {
        body = await request.json();
    } catch {
        return cors({ error: 'Invalid JSON body' }, 400, env, request);
    }

    // Rate limiting — always applied (worker only handles server-key traffic)
    if (env.RATE_LIMIT) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const rateKey = `rl:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
        const current = parseInt((await env.RATE_LIMIT.get(rateKey)) ?? '0', 10);
        if (current >= RATE_LIMIT_PER_HOUR) {
            return cors({ error: 'Too many requests' }, 429, env, request, { 'Retry-After': '60' });
        }
        await env.RATE_LIMIT.put(rateKey, String(current + 1), { expirationTtl: 3700 });
    }

    const text = body.text?.trim();
    if (!text) return cors({ error: 'Missing text' }, 400, env, request);
    if (text.length > MAX_TEXT_LENGTH) return cors({ error: 'Text too long (max 8000 chars)' }, 400, env, request);

    const provider: Provider = body.provider ?? 'gemini';
    const prompt = buildPrompt(text, body.sourceLang, body.targetLang);

    if (provider === 'openrouter') {
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return cors({ error: 'Invalid Key', detail: 'No OpenRouter API key configured on server.' }, 401, env, request);
        }
        const model = body.model ?? 'anthropic/claude-3-haiku';
        try {
            const translation = await callOpenRouterAPI(prompt, model, apiKey);
            return cors({ translation, model, provider: 'openrouter', cached: false }, 200, env, request);
        } catch (err: unknown) {
            return handleProviderError(err, env, request);
        }
    }

    // Default: Gemini
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        return cors({ error: 'Invalid Key', detail: 'No Gemini API key configured on server.' }, 401, env, request);
    }

    const requestedModel = (body.model ?? 'flash-lite') as GeminiModelKey;
    const fallbackQueue = [requestedModel, ...GEMINI_FALLBACK.filter(m => m !== requestedModel)];

    let lastStatus = 502;
    let lastError = '';

    for (const modelKey of fallbackQueue) {
        const modelName = GEMINI_MODEL_MAP[modelKey] ?? modelKey;
        try {
            const translation = await callGeminiAPI(prompt, modelName, apiKey);
            return cors({
                translation,
                model: modelName,
                provider: 'gemini',
                cached: false,
                fallbackUsed: modelKey !== requestedModel,
            }, 200, env, request);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            lastError = msg;
            const m = msg.match(/HTTP (\d+)/);
            if (m) lastStatus = parseInt(m[1], 10);

            if (lastStatus === 401 || lastStatus === 403) {
                return cors({ error: 'Invalid Key', detail: msg }, lastStatus, env, request);
            }
            if (lastStatus === 429) {
                const retryMatch = msg.match(/(\d+)s/);
                const retryAfter = retryMatch ? retryMatch[1] : '60';
                return cors(
                    { error: 'Too many requests', detail: msg },
                    429, env, request,
                    { 'Retry-After': retryAfter }
                );
            }
            // Non-fatal: try next model
        }
    }

    const finalStatus = lastStatus === 403 || lastStatus === 401 ? lastStatus : 502;
    const errMsg = lastStatus === 403 || lastStatus === 401 ? 'Key blocked' : 'All models failed';
    return cors({ error: errMsg, detail: lastError, allModelsFailed: true }, finalStatus, env, request);
}

async function callGeminiAPI(prompt: string, modelName: string, apiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json<any>();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!result) throw new Error('Empty response from Gemini');
    return result;
}

async function callOpenRouterAPI(prompt: string, model: string, apiKey: string): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://aurobie.app',
            'X-Title': 'Aurobie',
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 4096,
        }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json<any>();
    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) throw new Error('Empty response from OpenRouter');
    return result;
}

function handleProviderError(err: unknown, env: Env, request: Request): Response {
    const msg = err instanceof Error ? err.message : String(err);
    const m = msg.match(/HTTP (\d+)/);
    const status = m ? parseInt(m[1], 10) : 502;
    if (status === 401 || status === 403) return cors({ error: 'Invalid Key', detail: msg }, status, env, request);
    if (status === 429) return cors({ error: 'Too many requests', detail: msg }, 429, env, request, { 'Retry-After': '60' });
    return cors({ error: 'Translation failed', detail: msg, allModelsFailed: true }, 502, env, request);
}

function cors(
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