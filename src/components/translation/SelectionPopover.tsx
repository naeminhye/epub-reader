import { useLayoutEffect, useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { useT } from '@/lib/i18n/context';
import { BookOpenIcon, Cancel01Icon, TranslateIcon, NoteEditIcon, NoteRemoveIcon, HighlighterIcon, NoteAddIcon, UnavailableIcon, AudioBook03Icon } from '@hugeicons/core-free-icons';
import type { SelectionInfo } from '@/lib/epub/useEpubReader';
import type { HighlightColor } from '@/hooks/useHighlights';
import { translate } from '@/lib/translation/client';
import { useReaderStore } from '@/stores/readerStore';
import { speakText, stopSpeak } from '@/lib/speech';

interface SelectionPopoverProps {
    selection: SelectionInfo | null;
    // onTranslate: () => void;      // open TranslationPanel (side sheet)
    onDefine: () => void;
    onStudy: () => void;
    onHighlight: (color: HighlightColor) => void;
    onRemoveHighlight?: () => void;
    activeHighlightColor?: HighlightColor;
    onDismiss: () => void;
    /** Called after "Translate here" produces a result — caller injects it below the paragraph */
    onInjectTranslation?: (text: string, cfiRange: string) => void;
}

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; label: string }[] = [
    { color: 'yellow', bg: 'rgba(255,220,0,0.7)', label: 'Yellow' },
    { color: 'green', bg: 'rgba(163,230,53,0.7)', label: 'Green' },
    { color: 'blue', bg: 'rgba(96,165,250,0.7)', label: 'Blue' },
    { color: 'pink', bg: 'rgba(244,114,182,0.7)', label: 'Pink' },
];

type PopoverMode = 'actions' | 'translating' | 'result' | 'editing';

const POPOVER_WIDTH = 320;
const GAP = 8;

export function SelectionPopover({
    selection,
    // onTranslate,
    onDefine,
    onStudy,
    onHighlight,
    onDismiss,
    onInjectTranslation,
    onRemoveHighlight,
    activeHighlightColor
}: SelectionPopoverProps) {
    const t = useT();
    const prefs = useReaderStore(s => s.prefs);
    const currentBook = useReaderStore(s => s.currentBook);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [showColors, setShowColors] = useState(false);
    const [mode, setMode] = useState<PopoverMode>('actions');
    const [translationText, setTranslationText] = useState('');
    const [editDraft, setEditDraft] = useState('');
    const [translateError, setTranslateError] = useState('');

    const editRef = useRef<HTMLTextAreaElement>(null);

    // Reset state when selection changes
    useLayoutEffect(() => {
        if (!selection) {
            setPosition(null);
            setShowColors(false);
            setMode('actions');
            setTranslationText('');
            setTranslateError('');
            return;
        }
        const { rect } = selection;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
        left = Math.max(8, Math.min(left, viewportW - POPOVER_WIDTH - 8));

        // Height varies by mode — use a generous estimate for initial positioning
        const estimatedH = mode === 'result' || mode === 'editing' ? 160 : 44;
        let top = rect.top - estimatedH - GAP;
        if (top < 8) top = rect.bottom + GAP;
        top = Math.min(top, viewportH - estimatedH - 8);

        setPosition({ top, left });
    }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

    const isAbove = selection && position ? position.top < selection.rect.top : true;

    useEffect(() => {
        if (!selection) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selection, onDismiss]);

    useEffect(() => {
        if (mode === 'editing' && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [mode]);

    const handleTranslateHere = useCallback(async () => {
        if (!selection?.text) return;
        setMode('translating');
        setTranslateError('');
        try {
            const result = await translate({
                text: selection.text,
                targetLang: prefs.targetLang ?? 'vi',
                bookId: currentBook?.id,
            });
            setTranslationText(result.translation);
            setMode('result');
            // Inject below paragraph
            onInjectTranslation?.(result.translation, selection.cfiRange);
        } catch (err) {
            setTranslateError(err instanceof Error ? err.message : 'Translation failed');
            setMode('actions');
        }
    }, [selection, prefs.targetLang, currentBook?.id, onInjectTranslation]);

    const handleSaveEdit = useCallback(() => {
        if (!editDraft.trim()) return;
        setTranslationText(editDraft.trim());
        onInjectTranslation?.(editDraft.trim(), selection?.cfiRange ?? '');
        setMode('result');
    }, [editDraft, onInjectTranslation, selection?.cfiRange]);

    const handleRemove = useCallback(() => {
        onInjectTranslation?.('', selection?.cfiRange ?? '');  // empty text = remove
        setTranslationText('');
        setMode('actions');
    }, [onInjectTranslation, selection?.cfiRange]);

    // Stop speech on selection change
    // to prevent it from reading old selection after new one is made
    useEffect(() => {
        stopSpeak();
    }, [selection?.cfiRange]);

    if (!selection || !position) return null;

    return (
        <>
            {/* Scrim — dismiss on outside click */}
            <div
                className="fixed inset-0 z-[60]"
                onMouseDown={(e) => {
                    if (!popoverRef.current?.contains(e.target as Node)) onDismiss();
                }}
                aria-hidden="true"
            />

            <div
                ref={popoverRef}
                role="toolbar"
                aria-label={t.selectionActions}
                className="fixed z-[70] flex flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden"
                style={{ top: position.top, left: position.left, width: 'fit-content' }}
                onMouseDown={(e) => e.preventDefault()}
            >
                {/* ── Actions row ── */}
                {(mode === 'actions' || mode === 'translating') && (
                    <div className="flex items-center gap-0.5 px-1" style={{ height: 44 }}>
                        {/* Translate */}
                        <Button variant={mode === 'translating' ? 'secondary' : 'ghost'} size="sm"
                            onClick={handleTranslateHere} disabled={mode === 'translating'}
                            className="flex-1 h-8 gap-1 px-1.5" title={t.translateHere}>
                            {mode === 'translating'
                                ? <span className="w-3 h-3 border border-foreground/40 border-t-foreground rounded-full animate-spin" />
                                : <HugeiconsIcon icon={TranslateIcon} />}
                            <span className="hidden sm:inline text-xs">{mode === 'translating' ? t.translating : t.translate}</span>
                        </Button>

                        {/* Divider */}
                        <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                        {/* Define */}
                        <Button variant="ghost" size="sm" onClick={onDefine}
                            className="h-8 gap-1 px-1.5" title={t.defineTitle}>
                            <HugeiconsIcon icon={BookOpenIcon} />
                            <span className="hidden sm:inline text-xs">{t.define}</span>
                        </Button>

                        {/* Divider */}
                        <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                        {/* Study */}
                        <Button variant="ghost" size="sm" onClick={onStudy}
                            className="h-8 gap-1 px-1.5" title={t.study}>
                            <HugeiconsIcon icon={NoteAddIcon} />
                            <span className="hidden sm:inline text-xs">{t.study}</span>
                        </Button>

                        {/* Divider */}
                        <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                        {/* Highlight */}
                        <Button variant={showColors ? 'secondary' : 'ghost'} size="sm"
                            onClick={() => setShowColors(s => !s)}
                            className="h-8 gap-1 px-1.5 w-8 sm:w-auto" title={t.highlight}>
                            <HugeiconsIcon icon={HighlighterIcon} />
                            <span className="hidden sm:inline text-xs">{t.highlight}</span>
                        </Button>

                        {/* Divider */}
                        <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                        {/* Read Aloud */}
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={!selection?.text}
                            onClick={() =>
                                speakText(selection.text, {
                                    bookLang: currentBook?.language,
                                    splitBySentence: true,
                                })
                            }
                        >
                            <HugeiconsIcon icon={AudioBook03Icon} />
                            <span className="hidden sm:inline text-xs">{t.readAloud}</span>
                        </Button>

                        <Button variant="ghost" size="sm" onClick={onDismiss}
                            className="h-8 w-8 p-0 shrink-0" title={t.close}>
                            <HugeiconsIcon icon={Cancel01Icon} size={13} />
                        </Button>
                    </div>
                )}

                {/* Error */}
                {translateError && mode === 'actions' && (
                    <div className="px-3 py-1.5 border-t text-xs text-destructive bg-destructive/5">
                        {translateError}
                    </div>
                )}

                {/* Color picker row */}
                {showColors && mode === 'actions' && (
                    <div className="flex items-center justify-center gap-3 px-3 pb-2.5 pt-1 border-t">
                        {activeHighlightColor && (
                            // Already highlighted — show remove button
                            <button
                                key="remove-highlight"
                                type="button"
                                title={t.removeHighlights}
                                onClick={() => { onRemoveHighlight?.(); onDismiss(); }}
                                style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: "white",
                                    cursor: 'pointer',
                                    transition: 'transform .15s, border-color .15s',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.25)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--foreground)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                                }}
                            >
                                <HugeiconsIcon icon={UnavailableIcon} size={22} />
                            </button>
                        )}
                        {HIGHLIGHT_COLORS.map(({ color, bg, label }) => (
                            <button
                                key={color}
                                type="button"
                                title={label}
                                onClick={() => { onHighlight(color); setShowColors(false); onDismiss(); }}
                                style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: bg, border: '2px solid transparent', cursor: 'pointer',
                                    transition: 'transform .15s, border-color .15s',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.25)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--foreground)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* ── Translation result ── */}
                {mode === 'result' && (
                    <div className="flex flex-col">
                        {/* Result header */}
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                            <span className="text-xs font-medium text-muted-foreground">{t.translationResult}</span>
                            <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1"
                                    onClick={() => { setEditDraft(translationText); setMode('editing'); }}>
                                    <HugeiconsIcon icon={NoteEditIcon} />
                                    {t.editTranslation}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1"
                                    onClick={handleRemove}>
                                    <HugeiconsIcon icon={NoteRemoveIcon} />
                                    {t.removeTranslation}
                                </Button>
                            </div>
                        </div>
                        {/* Result text */}
                        <div className="px-3 pb-2.5 border-t pt-2 max-h-32 overflow-y-auto">
                            <p className="text-sm leading-relaxed" style={{ fontStyle: 'italic' }}>
                                {translationText}
                            </p>
                        </div>
                        {/* Back to actions */}
                        <div className="flex items-center border-t px-2 py-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                                onClick={() => setMode('actions')}>
                                ← {t.selectionActions}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-auto" onClick={onDismiss} title={t.close}>
                                <HugeiconsIcon icon={Cancel01Icon} />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Edit mode ── */}
                {mode === 'editing' && (
                    <div className="flex flex-col p-2 gap-1.5">
                        <textarea
                            ref={editRef}
                            value={editDraft}
                            onChange={e => setEditDraft(e.target.value)}
                            className="w-full text-sm leading-relaxed resize-none rounded border bg-background p-2 outline-none focus:ring-1 focus:ring-ring"
                            style={{ fontStyle: 'italic', minHeight: 72 }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit();
                                if (e.key === 'Escape') setMode('result');
                            }}
                        />
                        <div className="flex gap-1.5">
                            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveEdit}>
                                Save
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMode('result')}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {/* Arrow indicator */}
                <div
                    className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent ${isAbove ? 'top-full border-t-[6px] border-t-border' : 'bottom-full border-b-[6px] border-b-border'
                        }`}
                    aria-hidden="true"
                />
            </div>
        </>
    );
}