# Translation Proxy Worker

Cloudflare Worker that proxies translation requests to Google's Gemini API. Holds the API key server-side so it never reaches the browser.

## What it does

- Accepts `POST /translate` requests from the frontend
- Calls Gemini on your behalf using a stored secret key
- Implements a model fallback chain — if the requested model fails, tries the next one automatically
- Returns `Retry-After` headers on 429 so the frontend can back off correctly
- Adds CORS headers for browser access
- Optionally rate-limits per IP using Cloudflare KV

## Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
# or use the local version:
npm install  # from this worker/ directory
```

### 2. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser. Authorize, then return to the terminal.

### 3. Set the Gemini API key as a secret

```bash
wrangler secret put GEMINI_API_KEY
# paste your key from https://aistudio.google.com/apikey when prompted
```

Secrets are stored encrypted on Cloudflare's side. They are never in source files, `.env` files, or logs.

### 4. (Optional) Enable per-IP rate limiting

Without this step, the Worker has no per-IP rate limit. Fine for personal use. If the Worker URL ever leaks publicly, any IP could consume your Gemini quota.

```bash
# Create a KV namespace
wrangler kv namespace create RATE_LIMIT

# The command prints an id like:
# id = "abc123..."

# Open wrangler.toml and uncomment + fill the [[kv_namespaces]] block:
# [[kv_namespaces]]
# binding = "RATE_LIMIT"
# id = "abc123..."
```

Current limit: 200 requests per IP per hour (set by `RATE_LIMIT_PER_HOUR` in `src/index.ts`).

### 5. Deploy

```bash
npm run deploy
```

Wrangler prints your Worker URL:
```
https://epub-reader-vi-translate.<your-subdomain>.workers.dev
```

### 6. Test the deployment

```bash
# Health check
curl https://epub-reader-vi-translate.<your-subdomain>.workers.dev/health
# → {"ok":true}

# Translation test
curl -X POST https://epub-reader-vi-translate.<your-subdomain>.workers.dev/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"The sky is blue.","targetLang":"vi"}'
# → {"translation":"Bầu trời màu xanh.","model":"gemini-2.5-flash-lite","cached":false,"fallbackUsed":false}
```

### 7. Add the URL to the frontend

In your React project root (not this `worker/` folder), create `.env.local`:

```
VITE_TRANSLATION_API_URL=https://epub-reader-vi-translate.<your-subdomain>.workers.dev
```

Restart `npm run dev` so Vite picks up the new variable.

## Local development

```bash
npm run dev
# Worker runs on http://localhost:8787
```

Create `worker/.dev.vars` (gitignored by Wrangler automatically) for local secrets:

```
GEMINI_API_KEY=your_actual_key_here
```

Point the frontend at the local URL during development:
```
VITE_TRANSLATION_API_URL=http://localhost:8787
```

## Re-login after session expiry

Cloudflare auth tokens expire. If `wrangler deploy` fails with an auth error:

```bash
wrangler logout
wrangler login
wrangler deploy
```

The `GEMINI_API_KEY` secret persists across re-logins — you do not need to re-enter it.

## Restricting CORS for production

The default `ALLOWED_ORIGINS = "*"` accepts requests from any origin. In production, restrict this to your deployed frontend domain.

In `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGINS = "https://your-app.pages.dev,http://localhost:5173"
```

Then redeploy:
```bash
npm run deploy
```

## Model fallback chain

When the requested model fails (non-429 error), the Worker automatically retries with the next model:

```
flash-lite → flash → flash-preview → flash-lite-preview → pro
```

On **429 (rate limit)**, the Worker does **not** fall back — all models share the same project quota. It returns a 429 immediately with a `Retry-After` header. The frontend uses this to stop auto-translate and show a retry timer.

When **all models fail**, the response includes `"allModelsFailed": true` so the frontend can distinguish this from a partial error.

## Cost

| Resource              | Free tier            | Notes                                 |
| --------------------- | -------------------- | ------------------------------------- |
| Cloudflare Workers    | 100,000 requests/day | Resets daily                          |
| Cloudflare KV         | 100,000 reads/day    | Only used if rate limiting is enabled |
| Gemini 2.5 Flash-Lite | 15 RPM, 1,000 RPD    | Per Google project, not per Worker    |

Translation responses are cached in the browser's IndexedDB — repeated translations of the same text never hit the Worker.

## API reference

### `POST /translate`

Request body:
```json
{
  "text": "string — required, max 5000 chars",
  "sourceLang": "auto | en | fr | ... — optional, default 'auto'",
  "targetLang": "vi | en | fr | ... — optional, default 'vi'",
  "model": "flash-lite | flash | pro | flash-preview | flash-lite-preview — optional, default 'flash-lite'"
}
```

Success response `200`:
```json
{
  "translation": "Bầu trời màu xanh.",
  "model": "gemini-2.5-flash-lite",
  "cached": false,
  "fallbackUsed": false
}
```

Error responses:

| Status | Meaning                   | `Retry-After` header                    |
| ------ | ------------------------- | --------------------------------------- |
| `400`  | Missing or invalid input  | No                                      |
| `429`  | Gemini rate limit reached | Yes — seconds to wait                   |
| `403`  | Invalid API key           | No                                      |
| `502`  | All models failed         | No — includes `"allModelsFailed": true` |

### `GET /health`

Returns `{"ok": true}` with status 200. Use to verify the Worker is deployed and reachable.