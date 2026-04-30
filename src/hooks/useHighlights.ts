/**
 * useHighlights
 *
 * Highlights are stored in Dexie as { id, bookId, cfi, text, color }.
 *
 * DISPLAY STRATEGY — why we don't use rendition.annotations.highlight():
 *   epubjs's annotation API uses SVG rects measured from Range.getClientRects().
 *   When a selection starts or ends at an element boundary (no adjacent text node
 *   on one or both sides), those rects are 0×0 or wrong-sized, producing visual
 *   glitches. This is a known epubjs bug with no upstream fix.
 *
 *   Instead we inject marks directly into the iframe DOM:
 *   - Use rendition.getRange(cfi) to get the Range object (epubjs handles CFI decoding)
 *   - Call highlightRange(range, color) which wraps each text node in the range with
 *     a <mark class="aurobie-hl aurobie-hl-{id}"> element
 *   - A <style> injected into the iframe sets the background color per class
 *   - Removing a highlight deletes those <mark> elements by class name
 *
 * OVERLAP PREVENTION:
 *   Before adding, we check that the new CFI range does not contain any existing
 *   <mark> elements in the iframe. If it does, we reject the addition.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, type Highlight } from '@/lib/db/schema';
import type { Rendition } from 'epubjs';

export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
    yellow: '#fde047',   // fully opaque — mix handled by opacity on the element
    blue: '#93c5fd',
    green: '#a3e635',
    pink: '#f9a8d4',
};

// Opacity applied to <mark> elements so the text shows through
const MARK_OPACITY = 1;

export function useHighlights(bookId: string | undefined, rendition: Rendition | null) {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const renditionRef = useRef(rendition);
    renditionRef.current = rendition;

    // Load highlights for this book
    useEffect(() => {
        if (!bookId) { setHighlights([]); return; }
        db.highlights.where('bookId').equals(bookId).sortBy('createdAt').then(setHighlights).catch(console.error);
    }, [bookId]);

    const refresh = useCallback(async () => {
        if (!bookId) return;
        const hl = await db.highlights.where('bookId').equals(bookId).sortBy('createdAt');
        setHighlights(hl);
    }, [bookId]);

    // Re-apply highlights whenever the rendition renders a new view
    useEffect(() => {
        if (!rendition) return;
        const applyAll = (_: unknown, view: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doc = (view as any)?.document as Document | undefined;
            if (!doc) return;
            injectStylesheet(doc);
            // Re-apply all highlights that might be in this view
            highlights.forEach(h => {
                try { applyHighlightToDoc(h, doc, renditionRef.current!); } catch { /* cfi not in this view */ }
            });
        };
        rendition.on('rendered', applyAll);
        // Also apply to the currently visible view
        applyCurrentView(rendition, highlights);
        return () => { rendition.off('rendered', applyAll); };
    }, [rendition, highlights]);

    const addHighlight = useCallback(async (cfi: string, text: string, color: HighlightColor): Promise<{ added: boolean; overlap: boolean }> => {
        if (!bookId || !cfi || !renditionRef.current) return { added: false, overlap: false };

        // Check for overlap: try to get the range and see if any existing marks are in it
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const range: Range | null = (renditionRef.current as any).getRange?.(cfi) ?? null;
            if (range) {
                const fragment = range.cloneContents();
                const existingMarks = fragment.querySelectorAll('.aurobie-hl');
                if (existingMarks.length > 0) return { added: false, overlap: true };
            }
        } catch { /* getRange may throw for CFIs not in current view — allow the add */ }

        const hl: Highlight = {
            id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            bookId,
            text: text.slice(0, 500),
            cfi,
            color,
            createdAt: new Date(),
        };

        await db.highlights.add(hl);

        // Apply immediately to the live rendition
        if (renditionRef.current) {
            applyCurrentView(renditionRef.current, [hl]);
        }

        await refresh();
        return { added: true, overlap: false };
    }, [bookId, refresh]);

    const removeHighlight = useCallback(async (id: string) => {
        // Remove DOM marks from all currently rendered iframes
        if (renditionRef.current) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const views = (renditionRef.current as any).manager?.views?._views ?? [];
                for (const view of views) {
                    const doc = view?.document as Document | undefined;
                    if (!doc) continue;
                    doc.querySelectorAll(`.aurobie-hl-${id}`).forEach((mark: Element) => {
                        const parent = mark.parentNode;
                        if (!parent) return;
                        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
                        parent.removeChild(mark);
                        parent.normalize(); // merge adjacent text nodes
                    });
                }
            } catch { /* ignore */ }
        }

        await db.highlights.delete(id);
        await refresh();
    }, [refresh]);

    const recentHighlight = highlights.length > 0 ? highlights[highlights.length - 1] : null;

    return { highlights, addHighlight, removeHighlight, recentHighlight };
}

// ── Helpers ───────────────────────────────────────────────────────

/** Inject (or update) the highlight stylesheet in an iframe document */
function injectStylesheet(doc: Document) {
    const id = 'aurobie-hl-styles';
    if (doc.getElementById(id)) return; // already present
    const style = doc.createElement('style');
    style.id = id;
    style.textContent = `
    mark.aurobie-hl {
      background-color: var(--aurobie-hl-color, #fde047);
      opacity: ${MARK_OPACITY};
      color: inherit;
      border-radius: 2px;
      padding: 0;
      margin: 0;
    }
    mark.aurobie-hl:hover {
      opacity: ${Math.min(MARK_OPACITY + 0.25, 1)};
    }
  `;
    doc.head.appendChild(style);
}

/** Apply a single highlight to a specific document using the rendition's getRange */
function applyHighlightToDoc(h: Highlight, doc: Document, rendition: Rendition) {
    // Skip if already applied in this doc
    if (doc.querySelector(`.aurobie-hl-${h.id}`)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const range: Range | null = (rendition as any).getRange?.(h.cfi) ?? null;
    if (!range) return;

    // Verify the range is in this document
    if (range.startContainer.ownerDocument !== doc) return;

    wrapRangeWithMark(range, h.id, h.color);
}

/** Apply highlights to whatever views are currently rendered */
function applyCurrentView(rendition: Rendition, highlights: Highlight[]) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const views = (rendition as any).manager?.views?._views ?? [];
        for (const view of views) {
            const doc = view?.document as Document | undefined;
            if (!doc) continue;
            injectStylesheet(doc);
            highlights.forEach(h => {
                try { applyHighlightToDoc(h, doc, rendition); } catch { /* not in this view */ }
            });
        }
    } catch { /* ignore */ }
}

/**
 * Wrap all text content within a Range in <mark> elements.
 *
 * The naive approach (range.surroundContents) fails if the range crosses element
 * boundaries. We instead iterate all text nodes within the range and wrap each
 * individually. This is the same strategy used by most browser extension highlighters.
 */
function wrapRangeWithMark(range: Range, id: string, color: HighlightColor) {
    const doc = range.startContainer.ownerDocument!;
    const textNodes = getTextNodesInRange(range);
    if (textNodes.length === 0) return;

    for (const { node, start, end } of textNodes) {
        // Split text node at end first, then at start (order matters)
        let target: Text = node;
        if (end < node.length) target.splitText(end);
        if (start > 0) target = target.splitText(start);

        const mark = doc.createElement('mark');
        mark.className = `aurobie-hl aurobie-hl-${id}`;
        mark.style.setProperty('--aurobie-hl-color', HIGHLIGHT_COLORS[color]);
        mark.style.backgroundColor = hexToRgba(HIGHLIGHT_COLORS[color], MARK_OPACITY);
        // Remove the custom property approach — direct backgroundColor is more reliable
        mark.style.removeProperty('--aurobie-hl-color');
        target.parentNode!.insertBefore(mark, target);
        mark.appendChild(target);
    }
}

interface TextNodeSlice {
    node: Text;
    start: number;
    end: number;
}

/** Get all Text nodes within a Range, with their slice offsets */
function getTextNodesInRange(range: Range): TextNodeSlice[] {
    const results: TextNodeSlice[] = [];
    const walker = range.startContainer.ownerDocument!.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node: Node): number {
                // Skip nodes that are completely outside the range
                const r = range.cloneRange();
                r.selectNode(node);
                if (range.compareBoundaryPoints(Range.END_TO_START, r) >= 0) return NodeFilter.FILTER_REJECT;
                if (range.compareBoundaryPoints(Range.START_TO_END, r) <= 0) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
        const textNode = node as Text;
        const isStart = textNode === range.startContainer;
        const isEnd = textNode === range.endContainer;
        results.push({
            node: textNode,
            start: isStart ? range.startOffset : 0,
            end: isEnd ? range.endOffset : textNode.length,
        });
    }

    return results;
}

function hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
}