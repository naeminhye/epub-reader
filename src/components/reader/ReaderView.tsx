import { useCallback, useEffect, useRef } from 'react';
import { useReaderStore } from '@/stores/readerStore';
import { useEpubReader } from '@/lib/epub/useEpubReader';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';
import { ReaderToolbar } from './ReaderToolbar';
import { SearchPanel } from './SearchPanel';
import { ReadingProgressPanel } from './ReadingProgressPanel';
import { StudyPanel } from './StudyPanel';
import { SelectionPopover } from '@/components/translation/SelectionPopover';
import { TranslationPanel } from '@/components/translation/TranslationPanel';
import { useT } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { LocationChangeHandler, SelectionHandler } from '@/lib/epub/useEpubReader';

export function ReaderView() {
    const t = useT();
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        currentBook,
        currentLocation,
        prefs,
        updatePrefs,
        setLocation,
        setTotalLocations,
        selection,
        setSelection,
        isTranslationPanelOpen,
        setTranslationPanelOpen,
        isSearchOpen,
        setSearchOpen,
        isProgressOpen,
        setProgressOpen,
        isStudyOpen,
        setStudyOpen,
        pageInfo,
        totalLocations,
    } = useReaderStore();

    const { translatePage, clearTranslations, updateVisibility, cancel, state: autoState } = useAutoTranslate({
        enabled: prefs.autoTranslate,
        showOriginal: prefs.showOriginal,
        targetLang: prefs.targetLang ?? 'vi',
        bookId: currentBook?.id,
        onRateLimit: useCallback((retryAfterSeconds?: number) => {
            updatePrefs({ autoTranslate: false });
            const msg = retryAfterSeconds
                ? t.rateLimitedWithTime(retryAfterSeconds)
                : t.rateLimited;
            toast.warning(msg, { duration: 8000 });
        }, [updatePrefs, t]),
    });

    const currentDocRef = useRef<Document | null>(null);

    const handleLocationChange = useCallback<LocationChangeHandler>(
        (cfi, progress, pageInfo) => setLocation(cfi, progress, pageInfo),
        [setLocation]
    );

    const handleSelection = useCallback<SelectionHandler>(
        (info) => setSelection(info),
        [setSelection]
    );

    const { isReady, toc, error, next, prev, goTo, search, rendition, totalLocations: locs } = useEpubReader({
        blob: currentBook?.epubBlob ?? null,
        containerRef,
        initialLocation: currentLocation,
        prefs,
        onLocationChange: handleLocationChange,
        onSelection: handleSelection,
    });

    // Sync totalLocations to store once generate() completes
    useEffect(() => {
        if (locs > 0) setTotalLocations(locs);
    }, [locs, setTotalLocations]);

    // Auto-translate: use rendered event (fires after epubjs finishes laying out)
    useEffect(() => {
        if (!isReady || !prefs.autoTranslate || !rendition) return;

        const handler = (_section: unknown, view: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (view as any)?.document as Document | undefined;
            if (!doc || doc === currentDocRef.current) return;
            currentDocRef.current = doc;
            setTimeout(() => translatePage(doc), 100);
        };

        rendition.on('rendered', handler);

        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = iframe?.contentDocument;
        if (doc && doc !== currentDocRef.current) {
            currentDocRef.current = doc;
            setTimeout(() => translatePage(doc), 100);
        }

        return () => { rendition.off('rendered', handler); cancel(); };
    }, [isReady, prefs.autoTranslate, rendition, translatePage, cancel]);

    useEffect(() => {
        const doc = currentDocRef.current;
        if (!doc || !prefs.autoTranslate) return;
        updateVisibility(doc, prefs.showOriginal);
    }, [prefs.showOriginal, prefs.autoTranslate, updateVisibility]);

    useEffect(() => {
        if (prefs.autoTranslate) return;
        const doc = currentDocRef.current;
        if (doc) clearTranslations(doc);
        cancel();
    }, [prefs.autoTranslate, clearTranslations, cancel]);

    // Keyboard navigation
    useEffect(() => {
        if (prefs.flowMode === 'scrolled') return;
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (isTranslationPanelOpen || isSearchOpen || isProgressOpen || isStudyOpen) return;
            if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault(); next();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault(); prev();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [next, prev, prefs.flowMode, isTranslationPanelOpen, isSearchOpen, isProgressOpen, isStudyOpen]);

    const handleTranslate = useCallback(() => {
        if (selection) setTranslationPanelOpen(true);
    }, [selection, setTranslationPanelOpen]);

    const handleDefine = useCallback(() => {
        if (selection) setTranslationPanelOpen(true);
    }, [selection, setTranslationPanelOpen]);

    const handleStudy = useCallback(() => {
        setStudyOpen(true);
    }, [setStudyOpen]);

    const handleDismiss = useCallback(() => {
        setSelection(null);
        const iframe = containerRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
        iframe?.contentDocument?.getSelection()?.removeAllRanges();
    }, [setSelection]);

    if (!currentBook) return null;

    const isPaginated = prefs.flowMode === 'paginated';
    const showNav = isReady && !selection && !isTranslationPanelOpen;

    return (
        <div className="fixed inset-0 bg-background flex flex-col z-50">
            <ReaderToolbar
                toc={toc}
                onGoTo={goTo}
                onSearchOpen={() => setSearchOpen(true)}
                onProgressOpen={() => setProgressOpen(true)}
            />

            {/* Auto-translate progress / error banner */}
            {(autoState.isTranslating || autoState.rateLimited || autoState.allModelsFailed) && (
                <div className={`shrink-0 px-4 py-1.5 border-b flex items-center gap-2 ${autoState.rateLimited || autoState.allModelsFailed ? 'bg-destructive/10' : 'bg-muted/60'
                    }`}>
                    {autoState.isTranslating && (
                        <div className="w-3 h-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin shrink-0" />
                    )}
                    <p className="text-xs text-muted-foreground flex-1">
                        {autoState.allModelsFailed
                            ? t.allModelsFailed
                            : autoState.rateLimited
                                ? (autoState.retryAfterSeconds
                                    ? t.rateLimitedWithTime(autoState.retryAfterSeconds)
                                    : t.rateLimited)
                                : `${t.translatingPage} ${autoState.translatedCount}/${autoState.totalCount}`}
                    </p>
                    {(autoState.rateLimited && !autoState.allModelsFailed) && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs shrink-0"
                            onClick={() => {
                                import('@/lib/translation/client').then(({ rateLimitState }) => rateLimitState.clear());
                                updatePrefs({ autoTranslate: true });
                            }}
                        >
                            {t.rateLimitRetry}
                        </Button>
                    )}
                </div>
            )}

            <main className="flex-1 relative overflow-hidden">
                <div ref={containerRef} className="absolute inset-0" />

                {!isReady && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background pointer-events-none">
                        <div className="text-center space-y-2">
                            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-muted-foreground font-heading">{t.openingBook}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background p-6">
                        <div className="text-center max-w-md space-y-3">
                            <p className="font-heading text-lg">{t.couldNotOpen}</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <p className="text-xs text-muted-foreground">{t.epubCorrupted}</p>
                        </div>
                    </div>
                )}

                {isReady && isPaginated && showNav && (
                    <>
                        <button type="button" aria-label={t.prevPage} onClick={prev}
                            className="absolute left-0 top-0 bottom-0 w-10 z-10 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-r from-background/30 to-transparent">
                            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} className="text-foreground/50" />
                        </button>
                        <button type="button" aria-label={t.nextPage} onClick={next}
                            className="absolute right-0 top-0 bottom-0 w-10 z-10 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-l from-background/30 to-transparent">
                            <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-foreground/50" />
                        </button>
                    </>
                )}
            </main>

            {/* Paginated footer */}
            {isReady && isPaginated && showNav && (
                <div className="hidden sm:flex items-center justify-center gap-4 py-2 border-t bg-background/80 shrink-0">
                    <Button variant="ghost" size="sm" onClick={prev} className="h-8 px-4 gap-1.5 text-xs">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                        {t.prev}
                    </Button>
                    {pageInfo && pageInfo.total > 1 && (
                        <span className="text-xs text-muted-foreground tabular-nums min-w-[3rem] text-center">
                            {pageInfo.page} / {pageInfo.total}
                        </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={next} className="h-8 px-4 gap-1.5 text-xs">
                        {t.next}
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                </div>
            )}

            {/* Scroll footer */}
            {isReady && !isPaginated && showNav && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-background/90 shrink-0">
                    <Button variant="ghost" size="sm" onClick={prev} className="h-8 gap-1.5 text-xs">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                        <span className="hidden sm:inline">{t.prevChapter}</span>
                    </Button>
                    <span className="text-xs text-muted-foreground">{t.scrollMode}</span>
                    <Button variant="ghost" size="sm" onClick={next} className="h-8 gap-1.5 text-xs">
                        <span className="hidden sm:inline">{t.nextChapter}</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                </div>
            )}

            <SelectionPopover
                selection={selection}
                onTranslate={handleTranslate}
                onDefine={handleDefine}
                onStudy={handleStudy}
                onDismiss={handleDismiss}
            />
            <TranslationPanel />
            <SearchPanel onSearch={search} onGoTo={goTo} />
            <ReadingProgressPanel
                open={isProgressOpen}
                onClose={() => setProgressOpen(false)}
                totalLocations={totalLocations}
            />
            <StudyPanel
                open={isStudyOpen}
                onClose={() => setStudyOpen(false)}
                initialTerm={selection?.text}
            />
        </div>
    );
}