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
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
      }
      .aurobie-trans-block:hover {
        opacity: 1;
      }
      .aurobie-trans-block[data-hidden="true"] {
        display: none;
      }
    `;
    doc.head.appendChild(style);

    // Click → notify parent with block identity + text + position
    doc.addEventListener('click', (e) => {
      const block = (e.target as Element).closest('.aurobie-trans-block') as HTMLElement | null;
      if (!block) return;
      e.stopPropagation();
      const rect = block.getBoundingClientRect();
      // getBoundingClientRect is relative to the iframe viewport — convert to top-level viewport
      const iframes = window.parent.document.querySelectorAll('iframe');
      let iframeRect = { top: 0, left: 0 };
      for (const iframe of Array.from(iframes)) {
        try {
          if (iframe.contentDocument === doc) {
            iframeRect = iframe.getBoundingClientRect();
            break;
          }
        } catch { /* cross-origin, skip */ }
      }
      window.parent.postMessage({
        type: 'aurobie-trans-block-click',
        transId: block.dataset.transId ?? '',
        text: block.textContent ?? '',
        rect: {
          top: rect.top + iframeRect.top,
          bottom: rect.bottom + iframeRect.top,
          left: rect.left + iframeRect.left,
          right: rect.right + iframeRect.left,
          width: rect.width,
          height: rect.height,
        },
      }, '*');
    });
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

  const para = anchorEl.closest('p, h1, h2, h3, h4, li, blockquote') ?? anchorEl;

  const existing = para.parentElement?.querySelector(
    `.aurobie-trans-block[data-anchor-id="${(para as HTMLElement).dataset.aurobieTrans}"]`
  ) as HTMLElement | null;

  if (!translationText) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.textContent = translationText;
    return;
  }

  const anchorId = `at-${Date.now()}`;
  (para as HTMLElement).dataset.aurobieTrans = anchorId;

  const block = doc.createElement('div');
  block.className = 'aurobie-trans-block';
  block.dataset.anchorId = anchorId;
  block.dataset.transId = anchorId; // same value — used by click handler
  block.textContent = translationText;
  para.insertAdjacentElement('afterend', block);
}