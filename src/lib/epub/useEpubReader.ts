import { useCallback, useEffect, useRef, useState } from 'react';
import ePub, { type Book, type Rendition, type NavItem, type Location } from 'epubjs';
import readerCss from '@/styles/reader.css?raw';
import type { ReadingPrefs } from '@/lib/db/schema';

export interface SelectionInfo {
    text: string;
    cfiRange: string;
    rect: {
        top: number;
        left: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

export interface SearchResult {
    cfi: string;
    excerpt: string;
}

export type LocationChangeHandler = (
    cfi: string,
    progress: number,
    pageInfo: { page: number; total: number }
) => void;

export type SelectionHandler = (info: SelectionInfo | null) => void;

interface UseEpubReaderOptions {
    blob: Blob | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    initialLocation?: string | null;
    prefs: ReadingPrefs;
    onLocationChange?: LocationChangeHandler;
    onSelection?: SelectionHandler;
}

interface UseEpubReaderReturn {
    isReady: boolean;
    toc: NavItem[];
    error: string | null;
    next: () => void;
    prev: () => void;
    goTo: (target: string) => void;
    search: (query: string) => Promise<SearchResult[]>;
    rendition: Rendition | null;
    totalLocations: number;
}

export function useEpubReader({
    blob,
    containerRef,
    initialLocation,
    prefs,
    onLocationChange,
    onSelection,
}: UseEpubReaderOptions): UseEpubReaderReturn {
    const bookRef = useRef<Book | null>(null);
    const renditionRef = useRef<Rendition | null>(null);
    // Shared ref written by epubjs 'selected' event, read by bindSelection.
    // This is the reliable way to get a valid CFI for the current selection.
    const lastCfiRangeRef = useRef<string>('');
    const [isReady, setIsReady] = useState(false);
    const [toc, setToc] = useState<NavItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [totalLocations, setTotalLocations] = useState(0);

    const onLocationChangeRef = useRef(onLocationChange);
    const onSelectionRef = useRef(onSelection);
    const prefsRef = useRef(prefs);

    useEffect(() => {
        onLocationChangeRef.current = onLocationChange;
        onSelectionRef.current = onSelection;
    }, [onLocationChange, onSelection]);

    useEffect(() => {
        prefsRef.current = prefs;
    }, [prefs]);

    // Key: blob + flowMode + spread together. Changing flow mode recreates the rendition.
    const flowKey = `${prefs.flowMode}:${prefs.spread}`;

    useEffect(() => {
        if (!blob || !containerRef.current) return;

        let cancelled = false;
        setIsReady(false);
        setError(null);

        // Capture the location to restore after flow mode change
        const restoreLocation = renditionRef.current?.location?.start?.cfi
            ?? initialLocation
            ?? undefined;

        // Clean up previous rendition before creating new one
        try { renditionRef.current?.destroy(); } catch { /* ignore */ }
        renditionRef.current = null;

        const init = async () => {
            try {
                // Always destroy and reload book when flow mode changes to avoid
                // the `packaging undefined` error — the book object's internal state
                // is tied to the rendition and cannot be safely reused across renderTo calls.
                if (bookRef.current) {
                    try { bookRef.current.destroy(); } catch { /* ignore */ }
                    bookRef.current = null;
                }

                const arrayBuffer = await blob.arrayBuffer();
                if (cancelled) return;

                const book = ePub(arrayBuffer, { openAs: 'binary' });
                bookRef.current = book;

                // Wait for full book parse — both ready AND loaded.metadata must resolve
                // before calling renderTo, because renderTo's content hook fires injectIdentifier
                // synchronously which reads book.packaging.
                await book.ready;
                if (cancelled) return;

                // Explicitly drain loaded.metadata to guarantee packaging is populated
                await Promise.all([
                    book.loaded.metadata,
                    book.loaded.navigation,
                ]);
                if (cancelled) return;

                const rendition = book.renderTo(containerRef.current!, {
                    width: '100%',
                    height: '100%',
                    flow: prefsRef.current.flowMode === 'scrolled' ? 'scrolled-doc' : 'paginated',
                    spread: prefsRef.current.spread,
                    manager: 'default',
                });
                renditionRef.current = rendition;

                // Content hook: runs for EVERY chapter iframe that gets rendered.
                rendition.hooks.content.register((contents) => {
                    // Safety guard: packaging should always be defined now since we await
                    // loaded.metadata before renderTo, but guard anyway for edge cases.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!(book as any).packaging) return;

                    // Inject reader CSS
                    try {
                        const styleEl = contents.document.createElement('style');
                        styleEl.textContent = readerCss;
                        contents.document.head.appendChild(styleEl);
                    } catch (e) {
                        console.warn('[epub] CSS inject failed:', e);
                    }

                    // Apply theme/font/size — must read from ref, not closure, so latest prefs are used
                    applyBodyClasses(contents.document.body, prefsRef.current);

                    // Bind selection bridge
                    const iframe = contents.document.defaultView?.frameElement as HTMLIFrameElement | undefined;
                    if (iframe) {
                        bindSelection(contents.document, iframe, lastCfiRangeRef, (info) => {
                            onSelectionRef.current?.(info);
                        });
                    } else {
                        console.warn('[epub] frameElement null — selection bridge not bound for this chapter');
                    }
                });

                // epubjs 'selected' fires with a valid CFI range after every selection.
                // We store it in a ref so bindSelection can attach it to the SelectionInfo.
                rendition.on('selected', (cfiRange: string) => {
                    lastCfiRangeRef.current = cfiRange ?? '';
                });

                rendition.on('relocated', (location: Location) => {
                    if (!location?.start?.cfi) return;
                    const progress = book.locations.length()
                        ? book.locations.percentageFromCfi(location.start.cfi)
                        : location.start.percentage ?? 0;
                    const pageInfo = location.start.displayed ?? { page: 1, total: 1 };
                    onLocationChangeRef.current?.(location.start.cfi, progress, pageInfo);
                });

                // 'rendered' fires every time epubjs renders a spine item into a view
                // (including pre-rendered adjacent chapters). Re-apply theme here so
                // background-rendered chapters inherit current prefs.
                rendition.on('rendered', (_section: unknown, view: unknown) => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const doc = (view as any)?.document as Document | undefined;
                        if (doc?.body) applyBodyClasses(doc.body, prefsRef.current);
                    } catch { /* ignore — view may not have a document yet */ }
                });

                const nav = await book.loaded.navigation;
                if (!cancelled) setToc(nav.toc ?? []);

                await rendition.display(restoreLocation ?? undefined);

                book.locations.generate(1024).then(() => {
                    if (!cancelled) setTotalLocations(book.locations.length());
                }).catch(() => { });

                if (!cancelled) setIsReady(true);
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to load EPUB';
                    setError(message);
                    console.error('[epub] load error:', err);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            try { renditionRef.current?.destroy(); } catch { /* ignore */ }
            renditionRef.current = null;
            // Note: book is destroyed at the start of the next init() call,
            // not here, so we don't race with in-flight async operations.
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blob, flowKey]);

    // Final cleanup when component unmounts or blob changes
    useEffect(() => {
        return () => {
            try { bookRef.current?.destroy(); } catch { /* ignore */ }
            bookRef.current = null;
        };
    }, [blob]);

    // Re-apply theme/font/size to all live views when prefs change.
    // Two-pronged:
    //   1. rendition.themes.override() — epubjs's own API, reaches ALL rendered views
    //      including pre-rendered adjacent chapters that getContents() misses.
    //   2. getContents() loop — belt-and-suspenders for any views themes.override misses.
    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition || !isReady) return;

        // Map our prefs to CSS custom properties via themes.override
        // These override whatever the EPUB's own stylesheet sets on the body.
        const overrides: Record<string, string> = {
            '--reader-font-size': `${prefs.fontSize}px`,
            '--reader-line-height': String(prefs.lineHeight),
            '--reader-max-width': `${prefs.maxWidthCh}ch`,
        };

        // Theme colors
        const bgMap = { light: '#fafaf9', sepia: '#f4ecd8', dark: '#1a1a1a' };
        const fgMap = { light: '#1a1a1a', sepia: '#5b4636', dark: '#e5e5e5' };
        overrides['background-color'] = bgMap[prefs.theme];
        overrides['color'] = fgMap[prefs.theme];

        try {
            Object.entries(overrides).forEach(([k, v]) => {
                rendition.themes.override(k, v, true);
            });
        } catch { /* rendition may be mid-destroy */ }

        // Also apply body classes (theme/font) via getContents loop
        try {
            rendition.getContents().forEach((c) => {
                applyBodyClasses(c.document.body, prefs);
            });
        } catch { /* ignore */ }
    }, [prefs.theme, prefs.readerFont, prefs.fontSize, prefs.lineHeight, prefs.maxWidthCh, isReady]);

    const next = useCallback(() => {
        renditionRef.current?.next().catch(() => { });
    }, []);

    const prev = useCallback(() => {
        renditionRef.current?.prev().catch(() => { });
    }, []);

    const goTo = useCallback((target: string) => {
        renditionRef.current?.display(target).catch(() => { });
    }, []);

    const search = useCallback(async (query: string): Promise<SearchResult[]> => {
        const book = bookRef.current;
        if (!book || !query.trim()) return [];

        try {
            const q = query.trim();
            const results: SearchResult[] = [];

            // epubjs v0.3 has no book.search(). The correct API is:
            // iterate spine items, load each section, call section.find(query).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const spine = (book as any).spine;
            if (!spine?.spineItems?.length) return [];

            // Process all spine items in parallel for speed, with concurrency cap
            const items: unknown[] = Array.from(spine.spineItems);
            const CONCURRENCY = 4;

            for (let i = 0; i < items.length; i += CONCURRENCY) {
                const batch = items.slice(i, i + CONCURRENCY);
                const batchResults = await Promise.all(
                    batch.map(async (item) => {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const section = item as any;
                            // load() fetches and parses the section document
                            // Book.load is not present on the typed Book, so use a runtime check
                            const loader = (book as any)?.load;
                            if (typeof loader === 'function') {
                                await section.load(loader.bind(book));
                            } else {
                                // Fallback: call load without args if the loader isn't available on the book object
                                await section.load();
                            }
                            // find() returns [{cfi, excerpt}]
                            const found: Array<{ cfi: string; excerpt: string }> = section.find(q) ?? [];
                            section.unload?.();
                            return found;
                        } catch {
                            return [];
                        }
                    })
                );
                results.push(...batchResults.flat());
            }

            return results;
        } catch {
            return [];
        }
    }, []);

    return {
        isReady,
        toc,
        error,
        next,
        prev,
        goTo,
        search,
        rendition: renditionRef.current,
        totalLocations,
    };
}

function applyBodyClasses(body: HTMLElement, prefs: ReadingPrefs) {
    if (!body) return;
    body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    body.classList.add(`theme-${prefs.theme}`);
    body.classList.remove(
        'font-eb-garamond', 'font-merriweather',
        'font-montserrat', 'font-public-sans', 'font-system-serif'
    );
    body.classList.add(`font-${prefs.readerFont}`);
    body.classList.toggle('mode-scrolled', prefs.flowMode === 'scrolled');
    body.style.setProperty('--reader-font-size', `${prefs.fontSize}px`);
    body.style.setProperty('--reader-line-height', String(prefs.lineHeight));
    body.style.setProperty('--reader-max-width', `${prefs.maxWidthCh}ch`);
}

function bindSelection(
    doc: Document,
    iframe: HTMLIFrameElement,
    cfiRangeRef: React.MutableRefObject<string>,
    callback: (info: SelectionInfo | null) => void
) {
    let timer: number | undefined;

    const handler = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            const sel = doc.getSelection();
            if (!sel || sel.isCollapsed) { callback(null); return; }
            const text = sel.toString().trim();
            if (!text) { callback(null); return; }

            const range = sel.getRangeAt(0);
            const iframeRect = iframe.getBoundingClientRect();
            const rangeRect = range.getBoundingClientRect();

            const rect = {
                top: rangeRect.top + iframeRect.top,
                left: rangeRect.left + iframeRect.left,
                right: rangeRect.right + iframeRect.left,
                bottom: rangeRect.bottom + iframeRect.top,
                width: rangeRect.width,
                height: rangeRect.height,
            };

            // Read CFI from the ref — written by epubjs's 'selected' event which
            // fires reliably with a valid CFI whenever the user finishes selecting.
            const cfiRange = cfiRangeRef.current;

            callback({ text, cfiRange, rect });
        }, 200);
    };

    const clearHandler = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            const sel = doc.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) callback(null);
        }, 50);
    };

    doc.addEventListener('selectionchange', handler);
    doc.addEventListener('mouseup', handler);
    doc.addEventListener('touchend', handler);
    doc.addEventListener('mousedown', clearHandler);
}