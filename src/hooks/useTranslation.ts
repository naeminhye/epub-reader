import { useCallback, useRef, useState } from 'react';
import {
    translate,
    TranslationError,
    type TranslationRequest,
    type TranslationResult,
} from '@/lib/translation/client';

interface TranslationState {
    result: TranslationResult | null;
    isLoading: boolean;
    error: string | null;
}

export interface UseTranslationReturn {
    translate: (req: TranslationRequest) => Promise<void>;
    reset: () => void;
    result: TranslationResult | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * Hook for translating text with state management.
 * Cancels in-flight requests if a new translation is started.
 */
export function useTranslation(): UseTranslationReturn {
    const [state, setState] = useState<TranslationState>({
        result: null,
        isLoading: false,
        error: null,
    });

    // Track the latest request ID so stale responses don't overwrite newer ones
    const requestIdRef = useRef(0);

    const doTranslate = useCallback(async (req: TranslationRequest) => {
        const myRequestId = ++requestIdRef.current;

        setState({ result: null, isLoading: true, error: null });

        try {
            const result = await translate(req);
            // Discard if a newer request has started
            if (myRequestId !== requestIdRef.current) return;
            setState({ result, isLoading: false, error: null });
        } catch (err) {
            if (myRequestId !== requestIdRef.current) return;
            const message =
                err instanceof TranslationError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : 'Translation failed';
            setState({ result: null, isLoading: false, error: message });
        }
    }, []);

    const reset = useCallback(() => {
        requestIdRef.current++; // invalidate any in-flight
        setState({ result: null, isLoading: false, error: null });
    }, []);

    return {
        translate: doTranslate,
        reset,
        result: state.result,
        isLoading: state.isLoading,
        error: state.error,
    };
}