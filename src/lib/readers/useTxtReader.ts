import { useEffect, useState } from 'react';

export interface TxtReaderOptions {
    blob: Blob | null;
    onProgressChange?: (progress: number) => void;
}

export interface TxtReaderResult {
    isReady: boolean;
    error: string | null;
    content: string;
    /** word count */
    wordCount: number;
}

export function useTxtReader({ blob, onProgressChange }: TxtReaderOptions): TxtReaderResult {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [wordCount, setWordCount] = useState(0);

    useEffect(() => {
        if (!blob) return;
        let cancelled = false;

        blob.text().then(text => {
            if (cancelled) return;
            setContent(text);
            setWordCount(text.split(/\s+/).filter(Boolean).length);
            setIsReady(true);
            onProgressChange?.(0);
        }).catch(err => {
            if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
        });

        return () => { cancelled = true; };
    }, [blob]); // eslint-disable-line

    return { isReady, error, content, wordCount };
}