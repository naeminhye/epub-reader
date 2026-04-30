import { useCallback, useEffect, useRef, useState } from 'react';
import type * as PDFJSType from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export interface PdfReaderOptions {
    blob: Blob | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    initialPage?: number;
    onPageChange?: (page: number, total: number, progress: number) => void;
}

export interface PdfReaderResult {
    isReady: boolean;
    error: string | null;
    totalPages: number;
    currentPage: number;
    next: () => void;
    prev: () => void;
    goToPage: (n: number) => void;
}

export function usePdfReader({
    blob,
    containerRef,
    initialPage = 1,
    onPageChange,
}: PdfReaderOptions): PdfReaderResult {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(initialPage);

    const pdfRef = useRef<PDFDocumentProxy | null>(null);
    const renderingRef = useRef(false);
    const onPageChangeRef = useRef(onPageChange);
    onPageChangeRef.current = onPageChange;

    // Load the PDF document
    useEffect(() => {
        if (!blob) return;
        let cancelled = false;

        (async () => {
            try {
                const pdfjsLib: typeof PDFJSType = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/build/pdf.worker.mjs',
                    import.meta.url
                ).toString();

                const arrayBuffer = await blob.arrayBuffer();
                if (cancelled) return;

                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                if (cancelled) { pdf.destroy(); return; }

                pdfRef.current = pdf;
                setTotalPages(pdf.numPages);
                setCurrentPage(prev => Math.min(Math.max(1, initialPage), pdf.numPages) || prev);
                setIsReady(true);
                setError(null);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
            }
        })();

        return () => {
            cancelled = true;
            pdfRef.current?.destroy().catch(() => { });
            pdfRef.current = null;
            setIsReady(false);
        };
    }, [blob]); // eslint-disable-line

    // Render the current page to canvas
    useEffect(() => {
        const pdf = pdfRef.current;
        const container = containerRef.current;
        if (!pdf || !container || !isReady) return;
        if (renderingRef.current) return;

        let cancelled = false;
        renderingRef.current = true;

        (async () => {
            try {
                const page: PDFPageProxy = await pdf.getPage(currentPage);
                if (cancelled) return;

                // Scale to fit container width
                const containerW = container.clientWidth || 800;
                const naturalVP = page.getViewport({ scale: 1 });
                const scale = containerW / naturalVP.width;
                const viewport = page.getViewport({ scale });

                // Reuse or create canvas
                let canvas = container.querySelector<HTMLCanvasElement>('canvas.pdf-page');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page';
                    canvas.style.cssText = 'display:block;max-width:100%;height:auto;margin:0 auto;';
                    container.innerHTML = '';
                    container.appendChild(canvas);
                }
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d')!;
                await page.render({ canvas, canvasContext: ctx, viewport }).promise;

                if (cancelled) return;

                const progress = totalPages > 0 ? currentPage / totalPages : 0;
                onPageChangeRef.current?.(currentPage, totalPages, progress);
            } catch (err) {
                if (!cancelled) console.error('PDF render error:', err);
            } finally {
                renderingRef.current = false;
            }
        })();

        return () => { cancelled = true; };
    }, [isReady, currentPage, totalPages, containerRef]);

    const next = useCallback(() =>
        setCurrentPage(p => Math.min(p + 1, totalPages)), [totalPages]);

    const prev = useCallback(() =>
        setCurrentPage(p => Math.max(p - 1, 1)), []);

    const goToPage = useCallback((n: number) =>
        setCurrentPage(Math.min(Math.max(1, n), totalPages)), [totalPages]);

    return { isReady, error, totalPages, currentPage, next, prev, goToPage };
}