/**
 * AnnotationsPanel
 *
 * Unified sheet for Bookmarks and Highlights, shown as two tabs.
 */
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/context';
import type { Bookmark, Highlight } from '@/lib/db/schema';
import type { HighlightColor } from '@/hooks/useHighlights';
import { HIGHLIGHT_COLORS } from '@/hooks/useHighlights';

interface AnnotationsPanelProps {
    open: boolean;
    onClose: () => void;
    // Bookmarks
    bookmarks: Bookmark[];
    onGoToBookmark: (cfi: string) => void;
    onRemoveBookmark: (id: string) => void;
    // Highlights
    highlights: Highlight[];
    onGoToHighlight: (cfi: string) => void;
    onRemoveHighlight: (id: string) => void;
}

type Tab = 'bookmarks' | 'highlights';

export function AnnotationsPanel({
    open, onClose,
    bookmarks, onGoToBookmark, onRemoveBookmark,
    highlights, onGoToHighlight, onRemoveHighlight,
}: AnnotationsPanelProps) {
    const t = useT();
    const [tab, setTab] = useState<Tab>('bookmarks');

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0 h-full">
                <SheetHeader className="px-5 pt-5 pb-0 shrink-0">
                    <SheetTitle className="font-heading text-base">{t.bookmarks} &amp; {t.highlights}</SheetTitle>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-3 border-b" style={{ borderColor: 'var(--line)', marginLeft: -20, marginRight: -20, paddingLeft: 20 }}>
                        <TabBtn active={tab === 'bookmarks'} onClick={() => setTab('bookmarks')}>
                            <BookmarkIcon size={13} />
                            {t.bookmarks}
                            {bookmarks.length > 0 && (
                                <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: tab === 'bookmarks' ? 'var(--ink)' : 'var(--paper-3)', color: tab === 'bookmarks' ? 'var(--paper)' : 'var(--ink-3)' }}>
                                    {bookmarks.length}
                                </span>
                            )}
                        </TabBtn>
                        <TabBtn active={tab === 'highlights'} onClick={() => setTab('highlights')}>
                            <HighlightIcon size={13} />
                            {t.highlights ?? 'Highlights'}
                            {highlights.length > 0 && (
                                <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: tab === 'highlights' ? 'var(--ink)' : 'var(--paper-3)', color: tab === 'highlights' ? 'var(--paper)' : 'var(--ink-3)' }}>
                                    {highlights.length}
                                </span>
                            )}
                        </TabBtn>
                    </div>
                </SheetHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {tab === 'bookmarks' && (
                        <BookmarkList
                            bookmarks={bookmarks}
                            onGoTo={(cfi) => { onGoToBookmark(cfi); onClose(); }}
                            onRemove={onRemoveBookmark}
                            emptyLabel={t.bookmarkEmpty}
                        />
                    )}
                    {tab === 'highlights' && (
                        <HighlightList
                            highlights={highlights}
                            onGoTo={(cfi) => { onGoToHighlight(cfi); onClose(); }}
                            onRemove={onRemoveHighlight}
                            emptyLabel={t.highlightEmpty ?? 'No highlights yet'}
                        />
                    )}
                </div>

                {/* Footer counts */}
                <div className="px-5 py-2.5 border-t shrink-0 flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
                    <span className="text-xs text-muted-foreground">
                        {tab === 'bookmarks'
                            ? `${bookmarks.length} / 10 ${t.bookmarks.toLowerCase()}`
                            : `${highlights.length} ${(t.highlights ?? 'highlights').toLowerCase()}`}
                    </span>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Tab button ────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
            style={{
                color: active ? 'var(--ink)' : 'var(--ink-3)',
                marginBottom: -1,
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    );
}

// ── Bookmark list ─────────────────────────────────────────────────
function BookmarkList({ bookmarks, onGoTo, onRemove, emptyLabel }: {
    bookmarks: Bookmark[];
    onGoTo: (cfi: string) => void;
    onRemove: (id: string) => void;
    emptyLabel: string;
}) {
    if (bookmarks.length === 0) {
        return (
            <div className="flex items-center justify-center h-full px-6 py-16">
                <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{emptyLabel}</p>
            </div>
        );
    }
    return (
        <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {[...bookmarks].reverse().map((bm) => (
                <li key={bm.id}>
                    <button
                        type="button"
                        onClick={() => onGoTo(bm.cfi)}
                        className="w-full text-left px-5 py-4 transition-colors group"
                        style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'block' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        {bm.chapterTitle && (
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{bm.chapterTitle}</p>
                        )}
                        <p className="text-sm leading-relaxed" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)' }}>
                            "{bm.label}"
                        </p>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(bm.createdAt)}
                            </span>
                            <button
                                type="button"
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--ink-3)', background: 'transparent', border: 0, cursor: 'pointer', padding: '2px 6px' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                                onClick={(e) => { e.stopPropagation(); onRemove(bm.id); }}
                            >
                                ✕
                            </button>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
}

// ── Highlight list ────────────────────────────────────────────────
function HighlightList({ highlights, onGoTo, onRemove, emptyLabel }: {
    highlights: Highlight[];
    onGoTo: (cfi: string) => void;
    onRemove: (id: string) => void;
    emptyLabel: string;
}) {
    if (highlights.length === 0) {
        return (
            <div className="flex items-center justify-center h-full px-6 py-16">
                <p className="text-sm text-muted-foreground text-center" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{emptyLabel}</p>
            </div>
        );
    }
    return (
        <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {[...highlights].reverse().map((hl) => (
                <li key={hl.id}>
                    <button
                        type="button"
                        onClick={() => onGoTo(hl.cfi)}
                        className="w-full text-left px-5 py-4 transition-colors group"
                        style={{ background: 'transparent', border: 0, cursor: 'pointer', display: 'block' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        {/* Color swatch + text */}
                        <div className="flex items-start gap-3">
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: hexToRgba(HIGHLIGHT_COLORS[hl.color as HighlightColor] ?? '#fde047', 0.85), flexShrink: 0, marginTop: 3 }} />
                            <p className="text-sm leading-relaxed flex-1" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)' }}>
                                "{hl.text.length > 200 ? hl.text.slice(0, 200) + '…' : hl.text}"
                            </p>
                        </div>
                        <div className="flex items-center justify-between mt-2 pl-[24px]">
                            <span className="text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(hl.createdAt)}
                            </span>
                            <button
                                type="button"
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--ink-3)', background: 'transparent', border: 0, cursor: 'pointer', padding: '2px 6px' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                                onClick={(e) => { e.stopPropagation(); onRemove(hl.id); }}
                            >
                                ✕
                            </button>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
}

// ── SVG icons ─────────────────────────────────────────────────────
function BookmarkIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
    );
}

function HighlightIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
        </svg>
    );
}

function hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
}