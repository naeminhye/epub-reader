import { useCallback, useRef, useState } from 'react';
import { translate, TranslationError } from '@/lib/translation/client';

export interface AutoTranslateState {
    isTranslating: boolean;
    translatedCount: number;
    totalCount: number;
    rateLimited: boolean;
    allModelsFailed: boolean;
    retryAfterSeconds?: number;
}

interface UseAutoTranslateOptions {
    enabled: boolean;
    showTranslation: boolean;
    targetLang: string;
    bookId?: string;
    onRateLimit?: (retryAfterSeconds?: number) => void;
}

/**
 * Auto-translate strategy that does NOT break epubjs CFI indices.
 *
 * The root cause of IndexSizeError: inserting sibling DOM nodes between
 * paragraphs shifts child indices, invalidating stored CFI positions.
 *
 * Safe approach:
 *  - Set `data-translation="<translation>"` attribute on each <p> — no new nodes inserted
 *  - Inject a single <style id="epub-auto-translate-styles"> into <head>
 *  - The style uses `p[data-translation]::after { content: attr(data-translation) }` to render
 *    translations as CSS pseudo-elements — zero DOM structure change
 *  - showOriginal=false: also inject `p[data-translation] { font-size: 0; ... }` to hide
 *    original text while keeping the element in the layout (important for epubjs
 *    pagination column height calculations)
 *  - clearTranslations: removes data-translation attributes and the style element
 */
export function useAutoTranslate({
    enabled,
    showTranslation,
    targetLang,
    bookId,
    onRateLimit,
}: UseAutoTranslateOptions) {
    const [state, setState] = useState<AutoTranslateState>({
        isTranslating: false,
        translatedCount: 0,
        totalCount: 0,
        rateLimited: false,
        allModelsFailed: false,
    });

    const currentDocRef = useRef<Document | null>(null);
    const abortRef = useRef(false);

    // Inject or update the <style> block that renders translations
    const injectStyles = useCallback((doc: Document, show: boolean) => {
        let style = doc.getElementById('epub-auto-translate-styles') as HTMLStyleElement | null;
        if (!style) {
            style = doc.createElement('style');
            style.id = 'epub-auto-translate-styles';
            doc.head.appendChild(style);
        }
        style.textContent = `
      p[data-translation]::after,
      h1[data-translation]::after, h2[data-translation]::after,
      h3[data-translation]::after, h4[data-translation]::after {
        content: attr(data-translation);
        display: block;
        font-family: inherit;
        font-size: 0.88em;
        font-style: italic;
        line-height: 1.6;
        opacity: 0.85;
        border-left: 2px solid rgba(128,128,128,0.35);
        padding: 0.25em 0.6em;
        margin-top: 0.3em;
        color: inherit;
      }
      ${!show ? `
      p[data-translation], h1[data-translation], h2[data-translation], h3[data-translation], h4[data-translation] {
        font-size: 0 !important;
        line-height: 0 !important;
        opacity: 0 !important;
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
      p[data-translation]::after,
      h1[data-translation]::after, h2[data-translation]::after,
      h3[data-translation]::after, h4[data-translation]::after {
        font-size: 1rem;
        line-height: 1.6;
        opacity: 0.85;
      }
      ` : ''}
    `;
    }, []);

    const clearTranslations = useCallback((doc: Document) => {
        doc.getElementById('epub-auto-translate-styles')?.remove();
        doc.querySelectorAll('[data-translation]').forEach((el) => el.removeAttribute('data-translation'));
    }, []);

    const translatePage = useCallback(async (doc: Document) => {
        if (!enabled) return;
        abortRef.current = false;
        currentDocRef.current = doc;

        const paragraphs = Array.from(
            doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
        ).filter(
            (el): el is HTMLElement =>
                !el.hasAttribute('data-translation') &&
                (el.textContent?.trim().length ?? 0) > 10
        );

        if (paragraphs.length === 0) return;

        // Inject styles immediately so layout is stable before translations arrive
        injectStyles(doc, showTranslation);

        setState({ isTranslating: true, translatedCount: 0, totalCount: paragraphs.length, rateLimited: false, allModelsFailed: false });

        // Batch: group paragraphs up to ~3000 chars per API request
        const batches: HTMLElement[][] = [];
        let batch: HTMLElement[] = [];
        let chars = 0;

        for (const p of paragraphs) {
            const len = p.textContent!.trim().length;
            if (chars + len > 3000 && batch.length > 0) {
                batches.push(batch);
                batch = [];
                chars = 0;
            }
            batch.push(p);
            chars += len;
        }
        if (batch.length > 0) batches.push(batch);

        let done = 0;

        for (const group of batches) {
            if (abortRef.current || currentDocRef.current !== doc) break;

            const sourceText = group.map((p) => p.textContent!.trim()).join('\n\n---\n\n');

            try {
                const result = await translate({ text: sourceText, targetLang, bookId });

                if (abortRef.current || currentDocRef.current !== doc) break;

                const translated = result.translation.split(/\n\n---\n\n/);

                group.forEach((p, i) => {
                    const text = translated[i]?.trim();
                    if (text) {
                        p.setAttribute('data-translation', text);
                    }
                });

                done += group.length;
                setState({
                    isTranslating: done < paragraphs.length,
                    translatedCount: done,
                    totalCount: paragraphs.length,
                    rateLimited: false,
                    allModelsFailed: false,
                });
            } catch (err) {
                if (err instanceof TranslationError && (err.isRateLimited || err.allModelsFailed)) {
                    setState({
                        isTranslating: false,
                        translatedCount: done,
                        totalCount: paragraphs.length,
                        rateLimited: err.isRateLimited,
                        allModelsFailed: err.allModelsFailed,
                        retryAfterSeconds: err.retryAfterSeconds,
                    });
                    onRateLimit?.(err.retryAfterSeconds);
                    break;
                }
                // Non-fatal errors: skip batch silently
                done += group.length;
            }
        }

        setState((s) => ({ ...s, isTranslating: false }));
    }, [enabled, showTranslation, bookId, injectStyles]);

    const updateVisibility = useCallback((doc: Document, show: boolean) => {
        // Just re-inject the style block with updated show/hide rules
        const hasTranslations = doc.querySelector('[data-translation]') !== null;
        if (hasTranslations) injectStyles(doc, show);
    }, [injectStyles]);

    const cancel = useCallback(() => {
        abortRef.current = true;
        setState({ isTranslating: false, translatedCount: 0, totalCount: 0, rateLimited: false, allModelsFailed: false });
    }, []);

    return { translatePage, clearTranslations, updateVisibility, cancel, state };
}