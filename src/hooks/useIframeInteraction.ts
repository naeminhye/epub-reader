/**
 * useIframeInteraction
 *
 * Injects interactive UI into each epubjs iframe.
 *
 * KEY CONSTRAINT: epubjs iframes run in a sandboxed context (about:srcdoc).
 * The sandbox does NOT include `allow-scripts`, so <script> tags injected into
 * the iframe document are silently blocked. This means we cannot use a script
 * element to set up event listeners inside the iframe.
 *
 * SOLUTION: do all DOM work and event binding from the PARENT window.
 * The parent has full programmatic access to iframe.contentDocument, including
 * the ability to call addEventListener on elements inside it. Only inline
 * <script> execution is blocked — DOM API access from the parent is fine.
 *
 * Architecture:
 *   injectIntoDocument(doc)
 *     → injects <style> for hover UI (CSS works fine in the sandbox)
 *     → calls wrapParagraphs(doc) which:
 *         - wraps each <p>/<h*> in a .aurobie-para-wrap div
 *         - creates a .aurobie-para-bar action bar with Translate + Manual buttons
 *         - binds click events from the parent window (no script inside iframe)
 *         - binds edit/remove on any existing .aurobie-trans-block divs
 *
 *   _aurobiePutTranslation(paraId, text) is NOT set via script — instead
 *   ReaderView calls it directly on iframe.contentWindow after the translation
 *   completes, using a helper exported from this module.
 *
 * Communication: parent calls onMessage(msg) directly — no postMessage needed
 * since we own the event binding. postMessage is only used as a fallback for
 * cases where the iframe's own script (if any) posts.
 */

import { useCallback, useRef } from 'react';

export type IframeMessage =
  | { type: 'translate-para'; text: string; rect: DOMRectInit }
  | { type: 'manual-translate'; text: string; paraId: string }
  | { type: 'edit-translation'; paraId: string; currentText: string }
  | { type: 'remove-translation'; paraId: string };

interface UseIframeInteractionOptions {
  enabled: boolean;
  onMessage: (msg: IframeMessage) => void;
}

let idCounter = 0;

export function useIframeInteraction({ enabled, onMessage }: UseIframeInteractionOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const injectIntoDocument = useCallback((doc: Document) => {
    if (!enabled) return;

    // ── Inject CSS (works in sandboxed iframes) ───────────────────
    if (!doc.getElementById('aurobie-interaction-styles')) {
      const style = doc.createElement('style');
      style.id = 'aurobie-interaction-styles';
      style.textContent = `
        .aurobie-para-wrap {
          position: relative;
          padding-top: 32px; 
        }
        .aurobie-para-bar {
          display: none;
          position: absolute;
          top: 0; 
          left: 0;
          z-index: 9999;
          background: rgba(26, 24, 20, 0.93);
          border-radius: 6px;
          padding: 3px 5px;
          gap: 2px;
          align-items: center;
          box-shadow: 0 4px 14px -4px rgba(0,0,0,.5);
          white-space: nowrap;
          pointer-events: auto;
        }
        .aurobie-para-wrap:hover .aurobie-para-bar,
        .aurobie-para-bar:hover {
          display: flex !important;
        }
        .aurobie-para-btn {
          background: transparent;
          border: none;
          color: #e6dccb;
          font: 500 11px/1 -apple-system, system-ui, sans-serif;
          padding: 3px 7px;
          border-radius: 4px;
          cursor: pointer;
          letter-spacing: .02em;
        }
        .aurobie-para-btn:hover {
          background: rgba(255,255,255,.15);
        }
        .aurobie-para-btn-sep {
          width: 1px;
          height: 12px;
          background: rgba(255,255,255,.15);
          flex-shrink: 0;
        }
        .aurobie-trans-block {
          position: relative;
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
        .aurobie-trans-bar {
          display: none;
          position: absolute;
          top: 2px;
          right: 2px;
          z-index: 9999;
          background: rgba(26, 24, 20, 0.88);
          border-radius: 5px;
          padding: 2px 3px;
          gap: 2px;
          align-items: center;
        }
        .aurobie-trans-block:hover .aurobie-trans-bar {
          display: flex !important;
        }
        .aurobie-trans-btn {
          background: transparent;
          border: none;
          color: #d0c9bf;
          font: 500 10px/1 -apple-system, system-ui, sans-serif;
          padding: 3px 6px;
          border-radius: 3px;
          cursor: pointer;
        }
        .aurobie-trans-btn:hover {
          background: rgba(255,255,255,.15);
          color: #fff;
        }
        .aurobie-trans-edit {
          width: 100%;
          min-height: 3em;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 4px;
          color: inherit;
          font: italic 0.9em/1.5 inherit;
          padding: 4px 8px;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
          display: block;
        }
        .aurobie-edit-actions {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .aurobie-save-btn {
          background: #a3e635;
          color: #1a1814;
          border: none;
          border-radius: 4px;
          font: 600 10px/1 sans-serif;
          padding: 4px 10px;
          cursor: pointer;
        }
        .aurobie-cancel-btn {
          background: transparent;
          color: rgba(255,255,255,.5);
          border: none;
          font: 500 10px/1 sans-serif;
          padding: 4px 8px;
          cursor: pointer;
        }
      `;
      doc.head.appendChild(style);
    }

    // ── Wrap paragraphs and bind events from parent ───────────────
    wrapParagraphsFromParent(doc, onMessageRef);

    // ── Bind any existing translation blocks ──────────────────────
    doc.querySelectorAll<HTMLElement>('.aurobie-trans-block:not([data-bound])').forEach(block => {
      bindTransBlock(block, doc, onMessageRef);
    });

  }, [enabled]);

  return { injectIntoDocument };
}

// ── Parent-side DOM manipulation (no script inside iframe) ────────

function wrapParagraphsFromParent(
  doc: Document,
  onMessageRef: React.MutableRefObject<(msg: IframeMessage) => void>
) {
  const elements = Array.from(doc.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4'));

  for (const el of elements) {
    // Skip already wrapped, or translation blocks themselves
    if (el.dataset.aurobiePara || el.classList.contains('aurobie-trans-block')) continue;
    // Skip very short or empty paragraphs
    const text = el.textContent?.trim() ?? '';
    if (text.length < 5) continue;

    const paraId = `ap-${++idCounter}`;
    el.dataset.aurobiePara = paraId;

    // Wrap in a relative-positioned div so the action bar can be positioned above it
    const wrap = doc.createElement('div');
    wrap.className = 'aurobie-para-wrap';
    el.parentNode!.insertBefore(wrap, el);
    wrap.appendChild(el);

    // Build action bar
    const bar = doc.createElement('div');
    bar.className = 'aurobie-para-bar';

    const translateBtn = doc.createElement('button');
    translateBtn.className = 'aurobie-para-btn';
    translateBtn.textContent = 'Translate';

    const sep = doc.createElement('div');
    sep.className = 'aurobie-para-btn-sep';

    const manualBtn = doc.createElement('button');
    manualBtn.className = 'aurobie-para-btn';
    manualBtn.textContent = 'Translate here';

    bar.appendChild(translateBtn);
    bar.appendChild(sep);
    bar.appendChild(manualBtn);
    wrap.appendChild(bar);

    // Bind events FROM THE PARENT WINDOW — this is the key fix
    translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const paraText = el.textContent?.trim() ?? '';
      if (!paraText) return;
      const rect = el.getBoundingClientRect();
      // getBoundingClientRect in the iframe uses iframe-local coords.
      // Convert to viewport coords by adding the iframe's own offset.
      const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
      const iframeRect = iframe?.getBoundingClientRect();
      const viewportRect: DOMRectInit = iframeRect ? {
        x: rect.left + iframeRect.left,
        y: rect.top + iframeRect.top,
        width: rect.width,
        height: rect.height,
      } : {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      onMessageRef.current({ type: 'translate-para', text: paraText, rect: viewportRect });
      // const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
      // const iframeRect = iframe?.getBoundingClientRect();
      // const viewportRect: DOMRectInit = iframeRect ? {
      //   top: rect.top + iframeRect.top,
      //   left: rect.left + iframeRect.left,
      //   right: rect.right + iframeRect.left,
      //   bottom: rect.bottom + iframeRect.top,
      //   width: rect.width,
      //   height: rect.height,
      // } : rect;
      // onMessageRef.current({ type: 'translate-para', text: paraText, rect: viewportRect });
    });

    manualBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const paraText = el.textContent?.trim() ?? '';
      if (!paraText) return;
      onMessageRef.current({ type: 'manual-translate', text: paraText, paraId });
    });
  }

  // Set up a MutationObserver (from the parent) to handle dynamically added paragraphs
  if (!doc.body.dataset.aurobieMoAttached) {
    doc.body.dataset.aurobieMoAttached = '1';
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as HTMLElement;
          const tags = ['P', 'H1', 'H2', 'H3', 'H4'];
          if (tags.includes(el.tagName)) {
            wrapParagraphsFromParent(doc, onMessageRef);
          } else {
            el.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4').forEach(() => {
              wrapParagraphsFromParent(doc, onMessageRef);
            });
          }
        }
      }
    });
    mo.observe(doc.body, { childList: true, subtree: true });
  }
}

function bindTransBlock(
  block: HTMLElement,
  doc: Document,
  onMessageRef: React.MutableRefObject<(msg: IframeMessage) => void>
) {
  block.dataset.bound = '1';
  const paraId = block.dataset.aurobiePara ?? '';

  const bar = doc.createElement('div');
  bar.className = 'aurobie-trans-bar';

  const editBtn = doc.createElement('button');
  editBtn.className = 'aurobie-trans-btn';
  editBtn.textContent = '✎ Edit';

  const removeBtn = doc.createElement('button');
  removeBtn.className = 'aurobie-trans-btn';
  removeBtn.textContent = '✕';

  bar.appendChild(editBtn);
  bar.appendChild(removeBtn);
  block.appendChild(bar);

  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const textSpan = block.querySelector<HTMLElement>('.aurobie-trans-text');
    const currentText = textSpan?.textContent ?? block.dataset.translationText ?? '';

    bar.style.display = 'none';
    if (textSpan) textSpan.style.display = 'none';

    const textarea = doc.createElement('textarea');
    textarea.className = 'aurobie-trans-edit';
    textarea.value = currentText;

    const actions = doc.createElement('div');
    actions.className = 'aurobie-edit-actions';

    const saveBtn = doc.createElement('button');
    saveBtn.className = 'aurobie-save-btn';
    saveBtn.textContent = 'Save';

    const cancelBtn = doc.createElement('button');
    cancelBtn.className = 'aurobie-cancel-btn';
    cancelBtn.textContent = 'Cancel';

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    block.appendChild(textarea);
    block.appendChild(actions);
    textarea.focus();

    saveBtn.addEventListener('click', () => {
      const newText = textarea.value.trim();
      if (newText && textSpan) {
        textSpan.textContent = newText;
        block.dataset.translationText = newText;
      }
      textarea.remove();
      actions.remove();
      if (textSpan) textSpan.style.display = '';
      bar.style.display = '';
      onMessageRef.current({ type: 'edit-translation', paraId, currentText: newText });
    });

    cancelBtn.addEventListener('click', () => {
      textarea.remove();
      actions.remove();
      if (textSpan) textSpan.style.display = '';
      bar.style.display = '';
    });
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    block.remove();
    onMessageRef.current({ type: 'remove-translation', paraId });
  });
}

/**
 * Insert a translation block after a paragraph — called directly from ReaderView
 * after a manual translate completes. No script injection needed.
 */
export function putTranslationInDoc(
  doc: Document,
  paraId: string,
  text: string,
  onMessageRef: React.MutableRefObject<(msg: IframeMessage) => void>
) {
  const el = doc.querySelector<HTMLElement>(`[data-aurobie-para="${paraId}"]`);
  if (!el) return;

  // Remove existing block for this para
  const wrap = el.closest('.aurobie-para-wrap') ?? el.parentElement;
  wrap?.querySelector(`.aurobie-trans-block[data-aurobie-para="${paraId}"]`)?.remove();

  const block = doc.createElement('div');
  block.className = 'aurobie-trans-block';
  block.dataset.aurobiePara = paraId;
  block.dataset.translationText = text;

  const textSpan = doc.createElement('span');
  textSpan.className = 'aurobie-trans-text';
  textSpan.textContent = text;
  block.appendChild(textSpan);

  el.insertAdjacentElement('afterend', block);
  bindTransBlock(block, doc, onMessageRef);
}