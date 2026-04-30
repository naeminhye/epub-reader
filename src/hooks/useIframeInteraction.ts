/**
 * useIframeInteraction — minimal version
 *
 * Previously injected paragraph hover UI via DOM manipulation from the parent.
 * That feature has been removed in favour of handling everything in SelectionPopover.
 *
 * What remains:
 *   - injectIntoDocument(doc): injects the CSS for .aurobie-trans-block elements
 *     (used by manual "Translate here" results and auto-translate).
 *
 * putTranslationInDoc: helper called by ReaderView after a "Translate here"
 * result arrives — inserts or replaces a .aurobie-trans-block div below the
 * selected paragraph identified by its CFI range.
 */

import { useCallback } from 'react';

export type IframeMessage = never; // No postMessage usage anymore

interface UseIframeInteractionOptions {
  enabled: boolean;
}

export function useIframeInteraction({ enabled }: UseIframeInteractionOptions) {
  const injectIntoDocument = useCallback((doc: Document) => {
    if (!enabled) return;
    if (doc.getElementById('aurobie-trans-styles')) return;

    const style = doc.createElement('style');
    style.id = 'aurobie-trans-styles';
    style.textContent = `
      .aurobie-trans-block {
        font-style: italic;
        font-size: 0.88em;
        line-height: 1.6;
        opacity: 0.85;
        border-left: 2px solid rgba(128,128,128,0.35);
        padding: 0.25em 0.6em;
        margin-top: 0.3em;
        color: inherit;
      }
      .aurobie-trans-block[data-hidden="true"] {
        display: none;
      }
    `;
    doc.head.appendChild(style);
  }, [enabled]);

  return { injectIntoDocument };
}

/**
 * Insert or replace a .aurobie-trans-block div after the paragraph that
 * contains the given CFI range. Empty text = remove the block.
 *
 * Finding the right paragraph: we use the iframe's current selection range
 * if the CFI resolves to it, otherwise fall back to the last paragraph that
 * had text selected (stored as data-aurobie-selected on the element).
 */
export function putTranslationInDoc(
  doc: Document,
  translationText: string,
  anchorEl: Element | null
) {
  if (!anchorEl) return;

  // Find the nearest block-level ancestor that makes sense to insert after
  const para = anchorEl.closest('p, h1, h2, h3, h4, li, blockquote') ?? anchorEl;

  // Remove existing block if present
  const existing = para.parentElement?.querySelector(
    `.aurobie-trans-block[data-anchor-id="${(para as HTMLElement).dataset.aurobieTrans}"]`
  );
  existing?.remove();

  if (!translationText) return; // empty = remove only

  // Tag the para so we can find its block later
  const anchorId = `at-${Date.now()}`;
  (para as HTMLElement).dataset.aurobieTrans = anchorId;

  const block = doc.createElement('div');
  block.className = 'aurobie-trans-block';
  block.dataset.anchorId = anchorId;
  block.textContent = translationText;
  para.insertAdjacentElement('afterend', block);
}