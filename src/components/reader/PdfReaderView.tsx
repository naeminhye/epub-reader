import { useRef } from 'react';
import { usePdfReader } from '@/lib/readers/usePdfReader';
// import { useReaderStore } from '@/stores/readerStore';
import { useT } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface PdfReaderViewProps {
    fileBlob: Blob;
    initialPage: number;
    isFloating: boolean;
    showChrome: boolean;
    onPageChange: (page: number, total: number, progress: number) => void;
}

export function PdfReaderView({ fileBlob, initialPage, onPageChange }: PdfReaderViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const t = useT();
    // const { prefs } = useReaderStore();

    const { isReady, error, totalPages, currentPage, next, prev } = usePdfReader({
        blob: fileBlob,
        containerRef,
        initialPage,
        onPageChange,
    });

    return (
        <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--paper-2)' }}>
            {/* Scrollable page area */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center p-4 gap-4">
                {!isReady && !error && (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--line-2)', borderTopColor: 'var(--ink-3)' }} />
                    </div>
                )}
                {error && (
                    <div className="flex items-center justify-center h-full text-center p-8" style={{ color: 'var(--ink-3)' }}>
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {/* pdf.js renders into this container */}
                <div
                    ref={containerRef}
                    className="w-full max-w-3xl"
                    style={{
                        background: 'white',
                        boxShadow: '0 2px 20px rgba(0,0,0,.15)',
                        borderRadius: 4,
                        minHeight: isReady ? undefined : 400,
                    }}
                />
            </div>

            {/* Page nav */}
            {isReady && (
                <div className="flex items-center justify-center gap-4 py-2 border-t shrink-0"
                    style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                    <Button variant="ghost" size="sm" onClick={prev} disabled={currentPage <= 1} className="h-8 gap-1.5 text-xs">
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} /> {t.prev}
                    </Button>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
                        {t.locationOfCurrentPage(currentPage, totalPages)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={next} disabled={currentPage >= totalPages} className="h-8 gap-1.5 text-xs">
                        {t.next} <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </Button>
                </div>
            )}
        </div>
    );
}