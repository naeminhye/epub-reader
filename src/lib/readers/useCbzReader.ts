import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';

export interface CbzReaderOptions {
    blob: Blob | null;
    initialPage?: number;
    onPageChange?: (page: number, total: number, progress: number) => void;
}

export interface CbzReaderResult {
    isReady: boolean;
    error: string | null;
    totalPages: number;
    currentPage: number;
    currentImageUrl: string | null;
    next: () => void;
    prev: () => void;
    goToPage: (n: number) => void;
}

const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|avif)$/i;

export function useCbzReader({
    blob,
    initialPage = 1,
    onPageChange,
}: CbzReaderOptions): CbzReaderResult {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pages, setPages] = useState<string[]>([]);  // sorted image filenames
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

    const zipRef = useRef<JSZip | null>(null);
    const urlsRef = useRef<Map<number, string>>(new Map()); // page → object URL cache
    const onPageChangeRef = useRef(onPageChange);
    onPageChangeRef.current = onPageChange;

    // Load ZIP and enumerate images
    useEffect(() => {
        if (!blob) return;
        let cancelled = false;

        (async () => {
            try {
                const zip = await JSZip.loadAsync(blob);
                if (cancelled) return;

                const imageNames = Object.keys(zip.files)
                    .filter(name => IMAGE_EXTS.test(name) && !zip.files[name].dir)
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                if (imageNames.length === 0) throw new Error('No images found in CBZ');

                zipRef.current = zip;
                setPages(imageNames);
                setCurrentPage(Math.min(Math.max(1, initialPage), imageNames.length));
                setIsReady(true);
                setError(null);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load CBZ');
            }
        })();

        return () => {
            cancelled = true;
            // Revoke all cached object URLs
            urlsRef.current.forEach(url => URL.revokeObjectURL(url));
            urlsRef.current.clear();
            zipRef.current = null;
            setIsReady(false);
            setCurrentImageUrl(null);
        };
    }, [blob]); // eslint-disable-line

    // Load current page image
    useEffect(() => {
        const zip = zipRef.current;
        const name = pages[currentPage - 1];
        if (!zip || !name) return;

        // Use cached URL if available
        if (urlsRef.current.has(currentPage)) {
            setCurrentImageUrl(urlsRef.current.get(currentPage)!);
            onPageChangeRef.current?.(currentPage, pages.length, currentPage / pages.length);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
                const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
                const ab = await zip.file(name)!.async('arraybuffer');
                if (cancelled) return;
                const url = URL.createObjectURL(new Blob([ab], { type: mime }));
                urlsRef.current.set(currentPage, url);
                setCurrentImageUrl(url);
                onPageChangeRef.current?.(currentPage, pages.length, currentPage / pages.length);
            } catch (err) {
                if (!cancelled) console.error('CBZ page load error:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [isReady, currentPage, pages]);

    const next = useCallback(() =>
        setCurrentPage(p => Math.min(p + 1, pages.length)), [pages.length]);
    const prev = useCallback(() =>
        setCurrentPage(p => Math.max(p - 1, 1)), []);
    const goToPage = useCallback((n: number) =>
        setCurrentPage(Math.min(Math.max(1, n), pages.length)), [pages.length]);

    return { isReady, error, totalPages: pages.length, currentPage, currentImageUrl, next, prev, goToPage };
}