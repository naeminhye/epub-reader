import { useCallback, useEffect, useRef } from 'react';
import { useReaderStore } from '@/stores/readerStore';
import { useEpubReader } from '@/lib/epub/useEpubReader';
import { ReaderToolbar } from './ReaderToolbar';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

export function ReaderView() {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        currentBook,
        currentLocation,
        prefs,
        setLocation,
        setSelectedText,
        setTranslationPanelOpen,
    } = useReaderStore();

    const handleLocationChange = useCallback(
        (cfi: string, progress: number) => {
            setLocation(cfi, progress);
        },
        [setLocation]
    );

    const handleSelection = useCallback(
        (text: string) => {
            if (!text || text.length < 1) return;
            setSelectedText(text);
            setTranslationPanelOpen(true);
        },
        [setSelectedText, setTranslationPanelOpen]
    );

    const { isReady, toc, error, next, prev, goTo } = useEpubReader({
        blob: currentBook?.epubBlob ?? null,
        containerRef,
        initialLocation: currentLocation,
        prefs,
        onLocationChange: handleLocationChange,
        onSelection: handleSelection,
    });

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't intercept if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                next();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                prev();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [next, prev]);

    if (!currentBook) return null;

    return (
        <div className="fixed inset-0 bg-background flex flex-col z-50">
            <ReaderToolbar toc={toc} onGoTo={goTo} />

            <main className="flex-1 relative overflow-hidden">
                {/* The epubjs rendition mounts here */}
                <div ref={containerRef} className="absolute inset-0" />

                {/* Loading state */}
                {!isReady && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background pointer-events-none">
                        <div className="text-center space-y-2">
                            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-muted-foreground font-heading">Opening book…</p>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background p-6">
                        <div className="text-center max-w-md space-y-3">
                            <p className="font-heading text-lg">Could not open this book</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <p className="text-xs text-muted-foreground">
                                The EPUB file may be corrupted or use unsupported features.
                            </p>
                        </div>
                    </div>
                )}

                {/* Edge-tap navigation zones (mobile-friendly) */}
                {isReady && (
                    <>
                        <button
                            type="button"
                            aria-label="Previous page"
                            onClick={prev}
                            className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-start pl-1 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-r from-background/40 to-transparent"
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} size={24} className="text-foreground/60" />
                        </button>
                        <button
                            type="button"
                            aria-label="Next page"
                            onClick={next}
                            className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-end pr-1 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-l from-background/40 to-transparent"
                        >
                            <HugeiconsIcon icon={ArrowRight01Icon} size={24} className="text-foreground/60" />
                        </button>
                    </>
                )}
            </main>

            {/* Floating prev/next buttons for desktop */}
            {isReady && (
                <div className="hidden sm:flex absolute bottom-4 left-1/2 -translate-x-1/2 gap-2 z-20">
                    <Button variant="outline" size="sm" onClick={prev} className="shadow-sm">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={next} className="shadow-sm">
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                </div>
            )}
        </div>
    );
}