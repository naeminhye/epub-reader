# Aurobie

A web-based EPUB reader with Vietnamese translation, auto-translate, search, study group, and reading progress tracking. Built with React + Vite and a Cloudflare Worker proxy for the Gemini translation API.

## Stack

| Layer             | Technology                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| UI framework      | Vite + React 18 + TypeScript                                                        |
| Component library | shadcn/ui — preset `b6lcVNL6xs` (nova style, EB Garamond + Montserrat, lime accent) |
| EPUB rendering    | epubjs v0.3.x                                                                       |
| EPUB metadata     | JSZip                                                                               |
| Persistence       | Dexie (IndexedDB)                                                                   |
| State             | Zustand                                                                             |
| Translation API   | Gemini 2.5 Flash-Lite via Cloudflare Worker proxy                                   |
| Icons             | Hugeicons (`@hugeicons/react`, `@hugeicons/core-free-icons`)                        |
| i18n              | Custom context — English / Vietnamese                                               |

## Prerequisites

- Node.js 18+
- A Google AI Studio account for a Gemini API key (free, no credit card) — [aistudio.google.com](https://aistudio.google.com/apikey)
- A Cloudflare account for the Worker proxy (free tier) — [cloudflare.com](https://cloudflare.com)

## Setup

### 1. Scaffold the project

```bash
npx shadcn@latest init --preset b6lcVNL6xs --template vite
cd <your-project-name>
```

### 2. Install dependencies

```bash
npm install epubjs jszip dexie zustand
npm install @hugeicons/react @hugeicons/core-free-icons
npm install -D @types/jszip
```

### 3. Add shadcn components

```bash
npx shadcn@latest add button card dialog dropdown-menu context-menu
npx shadcn@latest add sheet scroll-area separator tabs
npx shadcn@latest add input textarea label
npx shadcn@latest add sonner
```

### 4. Copy source files

Copy this repository's `src/` into your scaffolded project:

- Replace `App.tsx`, `main.tsx`
- Copy `components/library/`, `components/reader/`, `components/translation/`
- Copy `hooks/`, `lib/`, `stores/`, `styles/reader.css`
- Copy `vite-env.d.ts`
- Keep your generated `components/ui/` and `styles/globals.css`

### 5. Deploy the translation Worker

See [`worker/README.md`](worker/README.md) for full instructions. Quick version:

```bash
cd worker
npm install
wrangler login
wrangler secret put GEMINI_API_KEY
npm run deploy
```

### 6. Configure the frontend

Create `.env.local` in the project root:

```
VITE_TRANSLATION_API_URL=https://epub-reader-vi-translate.<your-subdomain>.workers.dev
```

### 7. Run

```bash
npm run dev
```

## Features

### Library
- Import EPUB files via drag-and-drop or file picker
- Book covers extracted from EPUB metadata
- Status badges: **New** / **Reading** / **Done** (derived from reading progress)
- Reading progress bar on each book card
- Remove books via right-click context menu

### Reader
- Paginated and scrolled reading modes (toggle in toolbar)
- Single and double page spread (paginated mode only)
- Three themes: Light / Sepia / Dark (applied to all rendered chapters)
- Font picker: EB Garamond, Merriweather, System serif
- Font size and line height controls (− / + steppers)
- Table of contents with chapter navigation
- In-book full-text search with highlighted matches
- Keyboard navigation: `→` / `Space` / `PageDown` → next page, `←` / `PageUp` → previous page
- Reading progress saved automatically to IndexedDB
- Resume from last location on reopen

### Translation
- Allow users to choose target language for translation: Vietnamese, English, Korean, Chinese, ...
- **On-demand**: select text → popover → Translate → side panel with target language translation
- **Auto-translate**: translates entire page on load using CSS pseudo-elements (zero DOM structure changes — CFI locations unaffected)
- Show/hide original text toggle in auto-translate mode
- Translation caching in IndexedDB (cached requests are instant, no API quota used)
- Model fallback: Flash-Lite → Flash → Flash-Preview → Flash-Lite-Preview → Pro
- Rate limit handling: stops auto-translate on 429, shows retry timer, re-enable button

### Study Group
- Select any text → Study button → Study panel opens pre-filled with selected term
- Add a note to each term
- Edit notes inline by clicking them
- Export all terms for the current book as a UTF-8 CSV (Excel-compatible):
  ```
  Term,Note
  "selected text","your note"
  ```

### Reading Progress Panel
- Open by clicking the book title in the toolbar
- Circular progress ring showing % read
- Estimated pages read and remaining
- Estimated reading time remaining (based on 250 wpm average)
- Current chapter position bar
- Full book progress bar
- Updates live as you read; page/time estimates improve after `book.locations.generate()` completes in the background

### i18n
- English / Vietnamese / Korean UI toggle (persistent via localStorage)
- Auto-detects browser language on first visit
- Toggle button in the reader toolbar

## Project structure

```
src/
├── App.tsx                          # Root — wraps tree with LocaleProvider
├── main.tsx
├── vite-env.d.ts                    # VITE_TRANSLATION_API_URL type
├── components/
│   ├── ui/                          # shadcn auto-generated components
│   ├── library/
│   │   ├── BookCard.tsx             # Cover, status badge, progress bar, context menu
│   │   ├── ImportDropZone.tsx       # Drag-drop + click-to-browse import
│   │   └── LibraryView.tsx          # Bookshelf grid
│   ├── reader/
│   │   ├── ReaderView.tsx           # Main reader screen — wires all reader features
│   │   ├── ReaderToolbar.tsx        # Top bar: TOC, search, mode toggles, auto-translate, settings
│   │   ├── ReadingProgressPanel.tsx # % read, pages left, reading time estimate
│   │   ├── SearchPanel.tsx          # Full-text in-book search
│   │   └── StudyPanel.tsx           # Study group: add terms, notes, export CSV
│   └── translation/
│       ├── SelectionPopover.tsx     # Floating action menu on text selection
│       └── TranslationPanel.tsx    # Side sheet showing source + Vietnamese translation
├── hooks/
│   ├── useTranslation.ts            # On-demand translation with loading/error state
│   └── useAutoTranslate.ts          # Page-level auto-translate using CSS data attributes
├── lib/
│   ├── db/
│   │   ├── schema.ts                # Dexie schema v4 — books, translations, study, prefs
│   │   ├── bookRepo.ts              # Book CRUD
│   │   ├── highlightRepo.ts         # Highlight CRUD (UI removed, table retained)
│   │   └── studyRepo.ts             # Study entry CRUD + CSV export
│   ├── epub/
│   │   ├── useEpubReader.ts         # epubjs hook — render, navigate, theme, search, locations
│   │   ├── metadata.ts              # JSZip-based EPUB metadata extraction
│   │   └── epubjs.d.ts              # Hand-written TypeScript ambient declarations for epubjs
│   ├── i18n/
│   │   ├── translations.ts          # EN + VI string dictionaries (~100 keys each)
│   │   └── context.tsx              # LocaleProvider, useLocale(), useT()
│   └── translation/
│       └── client.ts                # Fetch wrapper with cache check, rate limit state, error types
├── stores/
│   ├── readerStore.ts               # Zustand — current book, prefs, UI panel state, progress
│   └── libraryStore.ts              # Zustand — book list, import flow
└── styles/
    ├── globals.css                  # shadcn theme tokens (auto-generated, do not edit)
    ├── globals-additions.css        # font-heading utility fix reference
    └── reader.css                   # Injected into EPUB iframes — themes, fonts, auto-translate styles
```

## Database schema

Dexie (IndexedDB) — current version: **4**

| Table          | Key           | Purpose                                      |
| -------------- | ------------- | -------------------------------------------- |
| `books`        | `id`          | EPUB blobs, metadata, reading progress       |
| `translations` | `key`         | SHA-256 keyed translation cache              |
| `highlights`   | `id`          | Saved highlights (UI removed, data retained) |
| `dictionary`   | `key`         | Dictionary lookup cache                      |
| `study`        | `id`          | Study group terms and notes                  |
| `prefs`        | `'singleton'` | Reading preferences — persisted single row   |

## Environment variables

| Variable                   | Required | Description                                                                    |
| -------------------------- | -------- | ------------------------------------------------------------------------------ |
| `VITE_TRANSLATION_API_URL` | Yes      | Cloudflare Worker URL, e.g. `https://epub-reader-vi-translate.xxx.workers.dev` |

## Known issues and caveats

### epubjs is unmaintained
Last published 4 years ago. Works for the vast majority of EPUBs. Known limitations: no TypeScript types (ambient declarations provided), occasional layout glitches in paginated mode on very long chapters, `Blocked script execution in about:srcdoc` console warnings from scripted EPUBs (cosmetic only — does not affect rendering).

### `book.locations.generate()` is slow
Runs in the background after a book opens. On a 500-page book this takes 5–15 seconds. The reading progress panel uses `totalLocations` from this call for time estimates — estimates are unavailable until generation completes.

### Auto-translate uses CSS pseudo-elements
Translations are stored as `data-vi` attributes on paragraph elements and rendered via `p[data-vi]::after { content: attr(data-vi) }`. This avoids inserting DOM nodes between paragraphs (which would break epubjs CFI location indices). The trade-off: pseudo-element content is not selectable or copyable by users.

### Gemini free tier limits
Gemini 2.5 Flash-Lite free tier: 15 RPM, 1,000 RPD. The Worker implements model fallback (Flash-Lite → Flash → Pro) but all models share the same project quota. On 429, auto-translate stops automatically and shows a retry timer. On-demand translation also respects the rate limit via an in-memory `rateLimitState`.

### Hugeicons free pack
Only icons from the Stroke Rounded free pack are used. If a TypeScript error appears about a missing icon, browse [hugeicons.com/icons](https://hugeicons.com/icons) and find the correct free-tier name.

### CSV export encoding
The study group CSV is exported with a UTF-8 BOM (`\uFEFF`) so Excel on Windows opens Vietnamese characters correctly without a manual encoding step.

## Keyboard shortcuts

| Key                        | Action                         |
| -------------------------- | ------------------------------ |
| `→` / `Space` / `PageDown` | Next page (paginated mode)     |
| `←` / `PageUp`             | Previous page (paginated mode) |
| `Escape`                   | Dismiss selection popover      |