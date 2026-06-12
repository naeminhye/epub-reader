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

        // Scroll listeners accumulate during init — must be declared here (not inside
        // the async init fn) so the synchronous cleanup return can access them.
        const scrollListeners: Array<() => void> = [];

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
                    const cfi = location.start.cfi;

                    // In scrolled mode 'relocated' fires when the user scrolls into a new
                    // spine item — the CFI is the START of that chapter, not the scroll
                    // position within it. We handle scroll-mode progress in the scroll
                    // listener below; here we only handle paginated mode.
                    if (prefsRef.current.flowMode === 'scrolled') return;

                    let progress: number;
                    if (book.locations.length()) {
                        progress = book.locations.percentageFromCfi(cfi);
                    } else {
                        progress = spineProgressFromCfi(cfi, book);
                    }

                    const pageInfo = location.start.displayed ?? { page: 1, total: 1 };
                    onLocationChangeRef.current?.(cfi, progress, pageInfo);
                });

                // Scroll-mode progress: listen to iframe scroll events directly.
                // When the user scrolls, calculate:
                //   progress = (spineIndex + scrollFraction) / totalSpineItems
                // where scrollFraction = scrollTop / (scrollHeight - clientHeight).
                // We throttle at ~250ms to avoid excessive store updates.

                const attachScrollListener = (view: unknown) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const doc = (view as any)?.document as Document | undefined;
                    if (!doc) return;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const section = (view as any)?.section;
                    const spineIndex: number = section?.index ?? 0;

                    let scrollTimer: ReturnType<typeof setTimeout> | null = null;

                    const onScroll = () => {
                        if (prefsRef.current.flowMode !== 'scrolled') return;
                        if (scrollTimer) clearTimeout(scrollTimer);
                        scrollTimer = setTimeout(() => {
                            const el = doc.documentElement;
                            const scrollHeight = el.scrollHeight - el.clientHeight;
                            const scrollFraction = scrollHeight > 0 ? el.scrollTop / scrollHeight : 0;

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const spine = (book as any).spine;
                            const totalItems: number = spine?.items?.length ?? spine?.spineItems?.length ?? 1;
                            const baseProgress = spineIndex / totalItems;
                            const itemProgress = scrollFraction / totalItems;
                            const progress = Math.min(baseProgress + itemProgress, 1);

                            // Use the current rendition CFI as the location marker
                            const cfi = rendition.currentLocation()?.start?.cfi
                                ?? `epubcfi(/6/${(spineIndex + 1) * 2})`;

                            onLocationChangeRef.current?.(cfi, progress, { page: 1, total: 1 });
                        }, 250);
                    };

                    doc.addEventListener('scroll', onScroll, { passive: true });
                    // Also listen on the root element for some epub layouts
                    doc.documentElement.addEventListener('scroll', onScroll, { passive: true });

                    const cleanup = () => {
                        if (scrollTimer) clearTimeout(scrollTimer);
                        doc.removeEventListener('scroll', onScroll);
                        doc.documentElement.removeEventListener('scroll', onScroll);
                    };
                    scrollListeners.push(cleanup);

                    // Fire once immediately to capture initial position
                    onScroll();
                };

                rendition.on('rendered', (_section: unknown, view: unknown) => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const doc = (view as any)?.document as Document | undefined;
                        if (doc?.body) applyBodyClasses(doc.body, prefsRef.current);
                    } catch { /* ignore — view may not have a document yet */ }

                    if (prefsRef.current.flowMode === 'scrolled') {
                        attachScrollListener(view);
                    }
                });

                const nav = await book.loaded.navigation;
                if (!cancelled) setToc(nav.toc ?? []);

                await rendition.display(restoreLocation ?? undefined);

                // Generate locations in the background.
                // When done, re-fire onLocationChange with the accurate percentage
                // so the progress bar updates without the user navigating.
                book.locations.generate(1024).then(() => {
                    if (cancelled) return;
                    setTotalLocations(book.locations.length());

                    // Only re-fire for paginated mode — scroll mode uses the scroll
                    // listener which already produces accurate progress without locations.
                    if (prefsRef.current.flowMode !== 'scrolled') {
                        const currentLocation = rendition.currentLocation() as Location | null;
                        const cfi = currentLocation?.start?.cfi;
                        if (cfi) {
                            const progress = book.locations.percentageFromCfi(cfi);
                            if (progress > 0) {
                                const pageInfo = currentLocation.start.displayed ?? { page: 1, total: 1 };
                                onLocationChangeRef.current?.(cfi, progress, pageInfo);
                            }
                        }
                    }
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
            // Clean up scroll listeners before destroying the rendition
            scrollListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
            try { renditionRef.current?.destroy(); } catch { /* ignore */ }
            renditionRef.current = null;
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

        overrides['background-color'] = THEME_BG[prefs.theme] ?? THEME_BG.light;
        overrides['color'] = THEME_FG[prefs.theme] ?? THEME_FG.light;

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
                            await section.load(book.load.bind(book));
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

const THEME_BG: Record<string, string> = { light: '#fafaf9', sepia: '#f4ecd8', dark: '#1a1a1a' };
const THEME_FG: Record<string, string> = { light: '#1a1a1a', sepia: '#5b4636', dark: '#e5e5e5' };

function applyBodyClasses(body: HTMLElement, prefs: ReadingPrefs) {
    if (!body) return;

    // Apply theme class + direct background/color to BOTH html and body so that
    // epub-supplied stylesheets (which often hardcode white on body or html) are
    // fully overridden and no light background leaks from the html element.
    const html = body.ownerDocument?.documentElement;
    const bg = THEME_BG[prefs.theme] ?? THEME_BG.light;
    const fg = THEME_FG[prefs.theme] ?? THEME_FG.light;

    if (html) {
        html.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
        html.classList.add(`theme-${prefs.theme}`);
        html.style.setProperty('background-color', bg, 'important');
        html.style.setProperty('color', fg, 'important');
    }

    body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    body.classList.add(`theme-${prefs.theme}`);
    body.style.setProperty('background-color', bg, 'important');
    body.style.setProperty('color', fg, 'important');

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

    const fire = (delay: number) => {
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

            const cfiRange = cfiRangeRef.current;
            if (!cfiRange) { callback(null); return; }

            callback({ text, cfiRange, rect });
        }, delay);
    };

    const clearHandler = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            const sel = doc.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) callback(null);
        }, 50);
    };

    // Mouse: 200ms is enough — epubjs 'selected' fires synchronously with mouseup
    doc.addEventListener('mouseup', () => fire(200));

    // Touch: epubjs 'selected' fires after a microtask delay on touch,
    // so we wait longer to ensure cfiRangeRef is populated
    doc.addEventListener('touchend', () => fire(400));

    // selectionchange can fire mid-drag — only use it as a fallback for mouse
    doc.addEventListener('selectionchange', () => {
        if (window.matchMedia('(pointer: fine)').matches) fire(200);
    });

    doc.addEventListener('mousedown', clearHandler);
}

/**
 * Calculate approximate reading progress from a CFI when book.locations is not
 * yet populated (i.e. locations.generate() hasn't finished).
 *
 * Strategy: parse the spine item index out of the CFI and use it relative to
 * the total spine item count, then add a fractional offset from the character
 * position within that item.
 *
 * A CFI looks like: epubcfi(/6/30!/4/2/62/2/1:297)
 *   - /6/30  → package spine, item at position 30 (1-indexed, even numbers only)
 *   - !/4/2/62/2/1:297 → within that item's document
 *
 * Spine items in the CFI use 1-indexed even numbers (2, 4, 6, ...) so
 * spineIndex = (number / 2) - 1.
 */
function spineProgressFromCfi(cfi: string, book: import('epubjs').Book): number {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spine = (book as any).spine;
        const totalItems: number = spine?.items?.length ?? spine?.spineItems?.length ?? 0;
        if (totalItems === 0) return 0;

        // Extract the spine step: the number after /6/ in the outer path
        // epubcfi(/6/N[idref]!...) — N is always an even integer
        const spineMatch = cfi.match(/^epubcfi\(\/6\/(\d+)/);
        if (!spineMatch) return 0;

        const spineStep = parseInt(spineMatch[1], 10);
        const spineIndex = Math.max(0, (spineStep / 2) - 1);   // convert to 0-based index

        // Extract character offset from the deepest :N in the CFI
        const charMatch = cfi.match(/:(\d+)\)?$/);
        const charOffset = charMatch ? parseInt(charMatch[1], 10) : 0;

        // Get the rough size of this spine item to calculate intra-chapter progress.
        // Use the item's `linear` property and fall back to 0 if unavailable.
        const item = spine?.items?.[spineIndex] ?? spine?.spineItems?.[spineIndex];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemLength: number = (item as any)?.length ?? 2048; // 2048 chars as rough default
        const intraChapter = Math.min(charOffset / Math.max(itemLength, 1), 1);

        // Progress = (spineIndex + intraChapter) / totalItems
        return Math.min((spineIndex + intraChapter) / totalItems, 1);
    } catch {
        return 0;
    }
}