import { useEffect } from 'react';
import { useCbzReader } from '@/lib/readers/useCbzReader';
import { useT } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface CbzReaderViewProps {
    fileBlob: Blob;
    initialPage: number;
    onPageChange: (page: number, total: number, progress: number) => void;
}

export function CbzReaderView({ fileBlob, initialPage, onPageChange }: CbzReaderViewProps) {
    const t = useT();
    const { isReady, error, totalPages, currentPage, currentImageUrl, next, prev } = useCbzReader({
        blob: fileBlob,
        initialPage,
        onPageChange,
    });

    // Keyboard nav
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
            else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [next, prev]);

    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground text-center">{error}</p>
        </div>
    );

    return (
        <div className="flex flex-col flex-1 min-h-0" style={{ background: '#111' }}>
            {/* Image area */}
            <div className="flex-1 overflow-auto flex items-start justify-center"
                onClick={e => { if ((e.clientX / window.innerWidth) > 0.5) next(); else prev(); }}>
                {!isReady && (
                    <div className="flex items-center justify-center h-full w-full">
                        <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/20 border-t-white/70" />
                    </div>
                )}
                {currentImageUrl && (
                    <img
                        src={currentImageUrl}
                        alt={`Page ${currentPage}`}
                        className="max-w-full h-auto select-none"
                        style={{ maxHeight: '100%', objectFit: 'contain' }}
                        draggable={false}
                    />
                )}
            </div>

            {/* Page nav overlay */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0"
                style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>
                <Button variant="ghost" size="sm" onClick={prev} disabled={currentPage <= 1}
                    className="h-8 gap-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={14} /> {t.prev}
                </Button>
                <span className="text-xs tabular-nums text-white/60">
                    {t.locationOfCurrentPage(currentPage, totalPages)}
                </span>
                <Button variant="ghost" size="sm" onClick={next} disabled={currentPage >= totalPages}
                    className="h-8 gap-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10">
                    {t.next} <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                </Button>
            </div>
        </div>
    );
}