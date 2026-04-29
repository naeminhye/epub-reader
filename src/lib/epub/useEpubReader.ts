import { useCallback, useEffect, useRef, useState } from 'react';
import ePub, { type Book, type Rendition, type NavItem, type Location } from 'epubjs';
import readerCss from '@/styles/reader.css?raw';
import type { ReadingPrefs } from '@/lib/db/schema';

interface UseEpubReaderOptions {
    blob: Blob | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    initialLocation?: string | null;
    prefs: ReadingPrefs;
    onLocationChange?: (cfi: string, progress: number) => void;
    onSelection?: (text: string, cfiRange: string) => void;
}

interface UseEpubReaderReturn {
    isReady: boolean;
    toc: NavItem[];
    error: string | null;
    next: () => void;
    prev: () => void;
    goTo: (target: string) => void;
    rendition: Rendition | null;
}

/**
 * Wraps the epubjs lifecycle. Mounts a Rendition to containerRef,
 * persists location changes, exposes navigation, and bridges text selection.
 *
 * Important behaviors:
 *  - Recreates the rendition when `blob` changes
 *  - Re-applies styles when prefs change (without re-mounting)
 *  - Re-binds selection listener after every chapter render (epubjs creates a fresh iframe per chapter)
 */
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
    const [isReady, setIsReady] = useState(false);
    const [toc, setToc] = useState<NavItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Keep latest callbacks and prefs in refs so the main effect doesn't need them in deps.
    // The content hook (registered once at mount) reads from these refs at runtime.
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

    // Main lifecycle: mount/unmount the book + rendition when blob changes
    useEffect(() => {
        if (!blob || !containerRef.current) return;

        let cancelled = false;
        setIsReady(false);
        setError(null);

        const init = async () => {
            try {
                // epubjs accepts ArrayBuffer directly via the openAs: 'binary' option
                const arrayBuffer = await blob.arrayBuffer();
                if (cancelled) return;

                const book = ePub(arrayBuffer, { openAs: 'binary' });
                bookRef.current = book;

                await book.ready;
                if (cancelled) return;

                const rendition = book.renderTo(containerRef.current!, {
                    width: '100%',
                    height: '100%',
                    flow: 'paginated',
                    spread: 'none', // single page, simpler for translation overlays
                    allowScriptedContent: false,
                    manager: 'default',
                });
                renditionRef.current = rendition;

                // Inject our reader CSS into every rendered chapter
                rendition.hooks.content.register((contents) => {
                    contents.addStylesheetCss(readerCss).catch(() => {
                        // Some EPUBs reject stylesheet injection; fall back to inline
                        const styleEl = contents.document.createElement('style');
                        styleEl.textContent = readerCss;
                        contents.document.head.appendChild(styleEl);
                    });

                    // Apply current theme/font classes to the chapter's body
                    applyBodyClasses(contents.document.body, prefsRef.current);

                    // Re-bind selection on the new iframe document
                    bindSelection(contents.document, (text, cfiRange) => {
                        onSelectionRef.current?.(text, cfiRange);
                    });
                });

                // Native epubjs selected event (for CFI-based highlights)
                rendition.on('selected', (cfiRange) => {
                    // We capture text via our own bridge for translation flow,
                    // but we expose cfiRange here for the highlight feature later.
                    void cfiRange;
                });

                // Navigation/location persistence
                rendition.on('relocated', (location: Location) => {
                    if (!location?.start?.cfi) return;
                    const progress = book.locations.length()
                        ? book.locations.percentageFromCfi(location.start.cfi)
                        : location.start.percentage ?? 0;
                    onLocationChangeRef.current?.(location.start.cfi, progress);
                });

                // Load TOC
                const nav = await book.loaded.navigation;
                if (!cancelled) setToc(nav.toc ?? []);

                // Display initial location (or beginning)
                await rendition.display(initialLocation ?? undefined);

                // Generate locations in the background for accurate progress %
                // This is slow on large books but doesn't block reading
                book.locations.generate(1024).catch(() => {
                    // ignore - progress will fall back to per-chapter %
                });

                if (!cancelled) setIsReady(true);
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to load EPUB';
                    setError(message);
                    console.error('EPUB load error:', err);
                }
            }
        };

        init();

        return () => {
            cancelled = true;
            try {
                renditionRef.current?.destroy();
            } catch {
                // already destroyed
            }
            try {
                bookRef.current?.destroy();
            } catch {
                // already destroyed
            }
            renditionRef.current = null;
            bookRef.current = null;
        };
        // We intentionally exclude prefs/initialLocation from this effect's deps:
        // - prefs changes are handled in a separate effect that re-applies styles
        // - initialLocation is read once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blob]);

    // Re-apply prefs to all currently-rendered chapters when they change
    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition || !isReady) return;

        const contents = rendition.getContents();
        contents.forEach((c) => {
            applyBodyClasses(c.document.body, prefs);
        });
    }, [prefs, isReady]);

    const next = useCallback(() => {
        renditionRef.current?.next().catch(() => { });
    }, []);

    const prev = useCallback(() => {
        renditionRef.current?.prev().catch(() => { });
    }, []);

    const goTo = useCallback((target: string) => {
        renditionRef.current?.display(target).catch(() => { });
    }, []);

    return {
        isReady,
        toc,
        error,
        next,
        prev,
        goTo,
        rendition: renditionRef.current,
    };
}

function applyBodyClasses(body: HTMLElement, prefs: ReadingPrefs) {
    if (!body) return;
    // Theme
    body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    body.classList.add(`theme-${prefs.theme}`);
    // Font
    body.classList.remove('font-eb-garamond', 'font-merriweather', 'font-system-serif');
    body.classList.add(`font-${prefs.readerFont}`);
    // Font size + line height via inline style on root for instant update
    body.style.setProperty('--reader-font-size', `${prefs.fontSize}px`);
    body.style.setProperty('--reader-line-height', String(prefs.lineHeight));
    body.style.setProperty('--reader-max-width', `${prefs.maxWidthCh}ch`);
}

function bindSelection(
    doc: Document,
    callback: (text: string, cfiRange: string) => void
) {
    // Debounced selection handler: fires after the user finishes selecting,
    // not on every micro-movement.
    let timer: number | undefined;

    const handler = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
            const sel = doc.getSelection();
            if (!sel || sel.isCollapsed) return;
            const text = sel.toString().trim();
            if (text.length < 1) return;
            // We pass an empty cfiRange here; the actual CFI is generated
            // separately when needed (for highlight persistence).
            callback(text, '');
        }, 250);
    };

    doc.addEventListener('selectionchange', handler);
    // Also listen for mouseup/touchend as a more reliable trigger across browsers
    doc.addEventListener('mouseup', handler);
    doc.addEventListener('touchend', handler);
}