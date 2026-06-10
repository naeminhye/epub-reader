import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReaderStore } from '@/stores/readerStore';
import { useEpubReader } from '@/lib/epub/useEpubReader';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';
import { useIframeInteraction, putTranslationInDoc } from '@/hooks/useIframeInteraction';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useHighlights } from '@/hooks/useHighlights';
import type { HighlightColor } from '@/hooks/useHighlights';
import { ReaderToolbar } from './ReaderToolbar';
import { AnnotationsPanel } from './AnnotationsPanel';
import { SearchPanel } from './SearchPanel';
import { ReadingProgressPanel } from './ReadingProgressPanel';
import { StudyPanel } from './StudyPanel';
import { WordLookupPanel } from '@/components/translation/WordLookupPanel';
import { SelectionPopover } from '@/components/translation/SelectionPopover';
import { TranslationSettingsPanel } from '@/components/translation/TranslationSettingsPanel';
import { TransBlockPopover } from '@/components/translation/TransBlockPopover';
import { useT } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { LocationChangeHandler, SelectionHandler } from '@/lib/epub/useEpubReader';
import { useLibraryStore } from '@/stores/libraryStore';

export function ReaderView() {
    const t = useT();
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        currentBook, currentLocation, prefs, updatePrefs,
        closeBook, progress,
        setLocation, setTotalLocations,
        selection, setSelection,
        isTranslationPanelOpen, 
        // setTranslationPanelOpen,
        isSearchOpen, setSearchOpen,
        isProgressOpen, setProgressOpen,
        isStudyOpen, setStudyOpen,
        isWordLookupOpen, setWordLookupOpen,
        isTranslationSettingsOpen, setTranslationSettingsOpen,
        isBookmarksOpen, setBookmarksOpen,
        pageInfo, totalLocations,
    } = useReaderStore();

    const isFloating = prefs.toolbarVariant === 'floating';

    // ── Chrome auto-fade (floating mode only) ────────────────────
    const [chromeVisible, setChromeVisible] = useState(true);
    const fadeTRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const wakeChrome = useCallback(() => {
        setChromeVisible(true);
        if (fadeTRef.current) clearTimeout(fadeTRef.current);
        fadeTRef.current = setTimeout(() => setChromeVisible(false), 3500);
    }, []);

    const handleTransBlockEdit = useCallback((transId: string, currentText: string) => {
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const block = doc.querySelector(`.aurobie-trans-block[data-trans-id="${transId}"]`) as HTMLElement | null;
        if (!block) return;

        const textarea = doc.createElement('textarea');
        textarea.value = currentText;
        textarea.style.cssText = `
        width: 100%; box-sizing: border-box;
        font-style: italic; font-size: 0.88em; line-height: 1.6;
        border: 1px solid rgba(128,128,128,0.4); border-radius: 4px;
        padding: 4px 8px; background: transparent; color: inherit;
        outline: none; resize: vertical; font-family: inherit;
    `;
        block.replaceWith(textarea);
        textarea.focus();
        textarea.select();

        const commit = () => {
            const newText = textarea.value.trim();
            if (!newText) { textarea.remove(); return; }
            const newBlock = doc.createElement('div');
            newBlock.className = 'aurobie-trans-block';
            newBlock.dataset.transId = transId;
            // Preserve anchorId so future edits/removes still find the block
            const anchorId = transId;
            newBlock.dataset.anchorId = anchorId;
            newBlock.textContent = newText;
            textarea.replaceWith(newBlock);
        };

        textarea.addEventListener('blur', commit);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { textarea.replaceWith(block); } // restore original
        });
    }, []);

    const handleTransBlockRemove = useCallback((transId: string) => {
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (!doc) return;
        doc.querySelector(`.aurobie-trans-block[data-trans-id="${transId}"]`)?.remove();
    }, []);

    useEffect(() => {
        if (!isFloating) { setChromeVisible(true); return; }
        wakeChrome();
        window.addEventListener('mousemove', wakeChrome);
        window.addEventListener('touchstart', wakeChrome, { passive: true });
        return () => {
            window.removeEventListener('mousemove', wakeChrome);
            window.removeEventListener('touchstart', wakeChrome);
            if (fadeTRef.current) clearTimeout(fadeTRef.current);
        };
    }, [isFloating, wakeChrome]);

    const anyPanelOpen = isTranslationPanelOpen || isSearchOpen || isProgressOpen
        || isStudyOpen || isWordLookupOpen || isTranslationSettingsOpen || isBookmarksOpen;
    const showChrome = !isFloating || chromeVisible || anyPanelOpen || !!selection;

    // ── epubjs hook ───────────────────────────────────────────────
    const handleLocationChange = useCallback<LocationChangeHandler>(
        (cfi, progress, pageInfo) => setLocation(cfi, progress, pageInfo),
        [setLocation]
    );
    const handleSelection = useCallback<SelectionHandler>(
        (info) => setSelection(info), [setSelection]
    );

    const { isReady, toc, error, next, prev, goTo, search, rendition, totalLocations: locs } = useEpubReader({
        blob: currentBook?.epubBlob ?? null,
        containerRef,
        initialLocation: currentLocation,
        prefs,
        onLocationChange: handleLocationChange,
        onSelection: handleSelection,
    });

    useEffect(() => { if (locs > 0) setTotalLocations(locs); }, [locs, setTotalLocations]);

    // ── Bookmarks ─────────────────────────────────────────────────
    const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarks(currentBook?.id);
    const currentCfi = useReaderStore(s => s.currentLocation);

    const handleToggleBookmark = useCallback(async () => {
        if (!currentCfi) return;
        const existing = bookmarks.find(b => b.cfi === currentCfi);
        if (existing) {
            await removeBookmark(existing.id);
            toast.success(t.bookmarkRemoved);
        } else {
            const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
            const visibleText = iframe?.contentDocument?.body?.innerText?.trim().slice(0, 80) ?? currentCfi;
            const chapterTitle = toc.find(item => item.href && currentCfi.includes(item.id ?? ''))?.label?.trim();
            const result = await addBookmark(currentCfi, visibleText, chapterTitle);
            if (result.limitReached) toast.warning(t.bookmarkLimit);
            else if (result.added) toast.success(t.bookmarkAdded);
        }
    }, [currentCfi, bookmarks, removeBookmark, addBookmark, t, toc]);

    // ── Highlights ────────────────────────────────────────────────
    const { highlights, addHighlight, removeHighlight } = useHighlights(currentBook?.id, rendition);

    const handleHighlight = useCallback(async (color: HighlightColor) => {
        if (!selection?.cfiRange || !selection.text) return;
        const result = await addHighlight(selection.cfiRange, selection.text, color);
        if (!result) return;
        if (result.overlap) toast.warning(t.highlightOverlap);
        else if (result.added) toast.success(t.highlightAdded);
        setSelection(null);
    }, [selection, addHighlight, t, setSelection]);

    // ── Inline "Translate here" injection ─────────────────────────
    // After SelectionPopover gets a translation result, inject it into the iframe
    // as a .aurobie-trans-block div below the selected paragraph.
    const handleInjectTranslation = useCallback((text: string, _cfiRange: string) => {
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (!doc) return;

        // Find the currently selected element (or its nearest block ancestor)
        const sel = doc.getSelection();
        const anchorEl = sel?.anchorNode?.nodeType === Node.TEXT_NODE
            ? sel.anchorNode.parentElement
            : sel?.anchorNode as Element | null;

        putTranslationInDoc(doc, text, anchorEl);
    }, []);

    // ── Auto-translate ────────────────────────────────────────────
    const { translatePage, clearTranslations, updateVisibility, cancel, state: autoState } = useAutoTranslate({
        enabled: prefs.autoTranslate,
        showTranslation: prefs.showTranslation,
        targetLang: prefs.targetLang ?? 'vi',
        bookId: currentBook?.id,
        onRateLimit: useCallback((retryAfterSeconds?: number) => {
            updatePrefs({ autoTranslate: false });
            toast.warning(retryAfterSeconds ? t.rateLimitedWithTime(retryAfterSeconds) : t.rateLimited, { duration: 8000 });
        }, [updatePrefs, t]),
    });

    const currentDocRef = useRef<Document | null>(null);

    const { injectIntoDocument } = useIframeInteraction({ enabled: true });

    // Auto-translate + inject CSS on every render
    useEffect(() => {
        if (!isReady || !rendition) return;
        const handler = (_: unknown, view: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (view as any)?.document as Document | undefined;
            if (!doc) return;
            injectIntoDocument(doc);
            if (!prefs.autoTranslate || doc === currentDocRef.current) return;
            currentDocRef.current = doc;
            setTimeout(() => translatePage(doc), 100);
        };
        rendition.on('rendered', handler);
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (doc) {
            injectIntoDocument(doc);
            if (prefs.autoTranslate && doc !== currentDocRef.current) {
                currentDocRef.current = doc;
                setTimeout(() => translatePage(doc), 100);
            }
        }
        return () => { rendition.off('rendered', handler); cancel(); };
    }, [isReady, prefs.autoTranslate, rendition, translatePage, cancel, injectIntoDocument]);

    useEffect(() => {
        const doc = currentDocRef.current;
        if (!doc || !prefs.autoTranslate) return;
        updateVisibility(doc, prefs.showTranslation);
    }, [prefs.showTranslation, prefs.autoTranslate, updateVisibility]);

    useEffect(() => {
        if (prefs.autoTranslate) return;
        const doc = currentDocRef.current;
        if (doc) clearTranslations(doc);
        cancel();
    }, [prefs.autoTranslate, clearTranslations, cancel]);

    // Keyboard nav — pages in paginated mode, chapters in scrolled mode.
    // Listens on window AND on the rendition: epubjs relays keydown events
    // from the chapter iframes, which never reach the window listener.
    useEffect(() => {
        const isPaginated = prefs.flowMode !== 'scrolled';
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (isTranslationPanelOpen || isSearchOpen || isProgressOpen || isStudyOpen) return;
            // Space only paginates; in scrolled mode keep its native scroll behavior
            if (e.key === 'ArrowRight' || e.key === 'PageDown' || (isPaginated && e.key === ' ')) {
                e.preventDefault?.(); next();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault?.(); prev();
            }
        };
        const renditionHandler = (...args: unknown[]) => handler(args[0] as KeyboardEvent);
        window.addEventListener('keydown', handler);
        rendition?.on('keydown', renditionHandler);
        return () => {
            window.removeEventListener('keydown', handler);
            rendition?.off('keydown', renditionHandler);
        };
    }, [next, prev, prefs.flowMode, rendition, isTranslationPanelOpen, isSearchOpen, isProgressOpen, isStudyOpen]);

    // const handleTranslate = useCallback(() => { if (selection) setTranslationPanelOpen(true); }, [selection, setTranslationPanelOpen]);
    const handleDefine = useCallback(() => { if (selection) setWordLookupOpen(true); }, [selection, setWordLookupOpen]);
    const handleStudy = useCallback(() => setStudyOpen(true), [setStudyOpen]);
    const handleDismiss = useCallback(() => {
        setSelection(null);
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        iframe?.contentDocument?.getSelection()?.removeAllRanges();
    }, [setSelection]);

    const handleBackToLibrary = useCallback(async () => {
        if (currentBook) {
            const { bookRepo } = await import('@/lib/db/bookRepo');

            await bookRepo.updateProgress(
            currentBook.id,
            progress,
            currentLocation ?? undefined
            );

            await useLibraryStore.getState().loadLibrary();
        }

        closeBook();
    }, [currentBook, currentLocation, progress, closeBook]);

    if (!currentBook) return null;

    const isPaginated = prefs.flowMode === 'paginated';
    const showNav = isReady && !isTranslationPanelOpen;
    const currentlyBookmarked = currentCfi ? isBookmarked(currentCfi) : false;

    const toolbarEl = (
        <ReaderToolbar
            toc={toc}
            onGoTo={goTo}
            onSearchOpen={() => setSearchOpen(true)}
            onProgressOpen={() => setProgressOpen(true)}
            onTranslationSettings={() => setTranslationSettingsOpen(true)}
            onBookmarksOpen={() => setBookmarksOpen(true)}
            isBookmarked={currentlyBookmarked}
            onToggleBookmark={handleToggleBookmark}
            onBack={handleBackToLibrary}
        />
    );

    const activeHighlight = useMemo(() => {
        if (!selection?.cfiRange || !rendition) return null;

        // Use the live DOM: check if the current selection range contains any highlight marks
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const range: Range | null = (rendition as any).getRange?.(selection.cfiRange) ?? null;
            if (!range) return null;

            const fragment = range.cloneContents();
            const markEl = fragment.querySelector('.aurobie-hl');
            if (!markEl) return null;

            // Extract the highlight ID from the class list: aurobie-hl-{id}
            const hlClass = [...markEl.classList].find(c => c.startsWith('aurobie-hl-') && c !== 'aurobie-hl');
            if (!hlClass) return null;

            const id = hlClass.replace('aurobie-hl-', '');
            return highlights.find(h => h.id === id) ?? null;
        } catch {
            return null;
        }
    }, [selection?.cfiRange, highlights, rendition]);

    return (
        <div
            className="fixed inset-0 flex flex-col z-50"
            style={{ background: 'var(--paper)', color: 'var(--ink)' }}
            onClick={isFloating && !showChrome ? wakeChrome : undefined}
        >
            {/* Persistent toolbar */}
            {!isFloating && toolbarEl}

            {/* Auto-translate banner */}
            {(autoState.isTranslating || autoState.rateLimited || autoState.allModelsFailed) && (
                <div className={`shrink-0 px-4 py-1.5 border-b flex items-center gap-2 ${autoState.rateLimited || autoState.allModelsFailed ? 'bg-destructive/10' : 'bg-muted/60'}`}>
                    {autoState.isTranslating && (
                        <div className="w-3 h-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin shrink-0" />
                    )}
                    <p className="text-xs text-muted-foreground flex-1">
                        {autoState.allModelsFailed ? t.allModelsFailed
                            : autoState.rateLimited
                                ? (autoState.retryAfterSeconds ? t.rateLimitedWithTime(autoState.retryAfterSeconds) : t.rateLimited)
                                : `${t.translatingPage} ${autoState.translatedCount}/${autoState.totalCount}`}
                    </p>
                    {autoState.rateLimited && !autoState.allModelsFailed && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0"
                            onClick={() => { import('@/lib/translation/client').then(({ rateLimitState }) => rateLimitState.clear()); updatePrefs({ autoTranslate: true }); }}>
                            {t.rateLimitRetry}
                        </Button>
                    )}
                </div>
            )}

            <main className="flex-1 relative overflow-hidden" onClick={isFloating ? wakeChrome : undefined}>
                {/* Floating toolbar */}
                {isFloating && (
                    <div style={{
                        position: 'absolute', left: 16, right: 16, top: 16, zIndex: 50,
                        opacity: showChrome ? 1 : 0,
                        transform: showChrome ? 'translateY(0)' : 'translateY(-8px)',
                        transition: 'opacity .35s ease, transform .35s ease',
                        pointerEvents: showChrome ? 'auto' : 'none',
                    }}>
                        <div style={{
                            borderRadius: 14, overflow: 'hidden',
                            boxShadow: '0 12px 40px -16px rgba(0,0,0,.18)',
                            border: '.5px solid var(--line-2)',
                            background: 'color-mix(in oklch, var(--paper) 88%, transparent)',
                            backdropFilter: 'blur(20px) saturate(160%)',
                            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                        }}>
                            {toolbarEl}
                        </div>
                    </div>
                )}

                <div ref={containerRef} className="absolute inset-0" />

                {/* Loading */}
                {!isReady && !error && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'var(--paper)' }}>
                        <div className="text-center space-y-3">
                            <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--line-2)', borderTopColor: 'var(--ink-3)' }} />
                            <p style={{ fontFamily: 'var(--serif)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-3)' }}>{t.openingBook}</p>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center p-8" style={{ background: 'var(--paper)' }}>
                        <div className="text-center max-w-md space-y-3">
                            <p style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink)' }}>{t.couldNotOpen}</p>
                            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>{error}</p>
                            <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>{t.epubCorrupted}</p>
                        </div>
                    </div>
                )}

                {/* Page nav arrows */}
                {isReady && isPaginated && showNav && (
                    <>
                        <button type="button" aria-label={t.prevPage} onClick={prev}
                            className="absolute left-0 top-0 bottom-0 w-16 sm:w-12 z-10 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                            style={{ background: 'linear-gradient(to right, color-mix(in oklch, var(--paper) 40%, transparent), transparent)' }}>
                            <HugeiconsIcon icon={ArrowLeft01Icon} size={22} style={{ color: 'var(--ink-3)' }} />
                        </button>
                        <button type="button" aria-label={t.nextPage} onClick={next}
                            className="absolute right-0 top-0 bottom-0 w-16 sm:w-12 z-10 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                            style={{ background: 'linear-gradient(to left, color-mix(in oklch, var(--paper) 40%, transparent), transparent)' }}>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={22} style={{ color: 'var(--ink-3)' }} />
                        </button>
                    </>
                )}
            </main>

            {/* ── Footers ── */}
            {!isFloating && isReady && showNav && (
                <div className="hidden sm:flex items-center justify-center gap-4 py-2 border-t shrink-0" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                    <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-4 gap-1.5 text-xs">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />{t.prev}
                    </Button>
                    {pageInfo && pageInfo.total > 1 && (
                        <span className="text-xs tabular-nums min-w-[3rem] text-center" style={{ color: 'var(--ink-3)' }}>
                            {pageInfo.page} / {pageInfo.total}
                        </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={next} className="h-8 px-4 gap-1.5 text-xs">
                        {t.next}<HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                </div>
            )}

            {isFloating && isReady && (
                <FloatingNavBar visible={showChrome} prev={prev} next={next} pageInfo={pageInfo} isPaginated={isPaginated} />
            )}

            {/* ── Panels ── */}
            <SelectionPopover
                selection={selection}
                onDefine={handleDefine}
                onStudy={handleStudy}
                onHighlight={handleHighlight}
                onRemoveHighlight={activeHighlight ? () => removeHighlight(activeHighlight.id) : undefined}
                activeHighlightColor={activeHighlight?.color}
                onDismiss={handleDismiss}
                onInjectTranslation={handleInjectTranslation}
            />
            <TransBlockPopover
                onEdit={handleTransBlockEdit}
                onRemove={handleTransBlockRemove}
            />
            {/* <TranslationPanel onOpenSettings={() => setTranslationSettingsOpen(true)} /> */}
            <SearchPanel onSearch={search} onGoTo={goTo} />
            <ReadingProgressPanel open={isProgressOpen} onClose={() => setProgressOpen(false)} totalLocations={totalLocations} />
            <StudyPanel open={isStudyOpen} onClose={() => setStudyOpen(false)} initialTerm={selection?.text} />
            <WordLookupPanel word={selection?.text ?? ''} open={isWordLookupOpen} onClose={() => setWordLookupOpen(false)} />
            <TranslationSettingsPanel open={isTranslationSettingsOpen} onClose={() => setTranslationSettingsOpen(false)} />
            <AnnotationsPanel
                open={isBookmarksOpen}
                onClose={() => setBookmarksOpen(false)}
                bookmarks={bookmarks}
                onGoToBookmark={goTo}
                onRemoveBookmark={removeBookmark}
                highlights={highlights}
                onGoToHighlight={goTo}
                onRemoveHighlight={removeHighlight}
            />
        </div>
    );
}

function FloatingNavBar({ visible, prev, next, pageInfo, isPaginated }: {
    visible: boolean;
    prev: () => void;
    next: () => void;
    pageInfo: { page: number; total: number } | null;
    isPaginated: boolean;
}) {
    const t = useT();
    return (
        <div style={{
            position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 16, padding: '10px 18px',
            background: 'color-mix(in oklch, var(--paper) 88%, transparent)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '.5px solid var(--line-2)', borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 12px 40px -16px rgba(0,0,0,.18)',
            opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity .35s, transform .35s',
        }}>
            <Button variant="ghost" size="sm" onClick={prev} className="h-8 gap-1.5 text-xs">
                <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                <span className="hidden sm:inline">{isPaginated ? t.prev : t.prevChapter}</span>
            </Button>
            <span className="flex-1 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
                {pageInfo && pageInfo.total > 1
                    ? t.locationOfCurrentPage(pageInfo.page, pageInfo.total)
                    : isPaginated ? t.paginatedMode : t.scrollMode}
            </span>
            <Button variant="ghost" size="sm" onClick={next} className="h-8 gap-1.5 text-xs">
                <span className="hidden sm:inline">{isPaginated ? t.next : t.nextChapter}</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </Button>
        </div>
    );
}