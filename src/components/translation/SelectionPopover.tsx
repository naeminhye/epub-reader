import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { useT } from '@/lib/i18n/context';
import { BookBookmark02Icon, BookOpenIcon, Cancel01Icon, TranslateIcon } from '@hugeicons/core-free-icons';
import type { SelectionInfo } from '@/lib/epub/useEpubReader';

interface SelectionPopoverProps {
    selection: SelectionInfo | null;
    onTranslate: () => void;
    onDefine: () => void;
    onStudy: () => void;
    onDismiss: () => void;
}

const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 44;
const GAP = 8;

export function SelectionPopover({
    selection,
    onTranslate,
    onDefine,
    onStudy,
    onDismiss,
}: SelectionPopoverProps) {
    const t = useT();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        if (!selection) { setPosition(null); return; }
        const { rect } = selection;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
        left = Math.max(8, Math.min(left, viewportW - POPOVER_WIDTH - 8));

        let top = rect.top - POPOVER_HEIGHT - GAP;
        if (top < 8) top = rect.bottom + GAP;
        top = Math.min(top, viewportH - POPOVER_HEIGHT - 8);

        setPosition({ top, left });
    }, [selection]);

    const isAbove = selection && position ? position.top < selection.rect.top : true;

    useEffect(() => {
        if (!selection) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selection, onDismiss]);

    if (!selection || !position) return null;

    return (
        <>
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
                className="fixed z-[70] flex items-center gap-0.5 px-1 rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
                style={{ top: position.top, left: position.left, height: POPOVER_HEIGHT, width: `fit-content` }}
                onMouseDown={(e) => e.preventDefault()}
            >
                <Button
                    variant="ghost" size="sm"
                    onClick={onTranslate}
                    className="flex-1 h-8 gap-1.5 px-2"
                    title={t.translateTitle}
                >
                    <HugeiconsIcon icon={TranslateIcon} />
                    <span className="text-xs">{t.translate}</span>
                </Button>

                <Button
                    variant="ghost" size="sm"
                    onClick={onDefine}
                    className="flex-1 h-8 gap-1.5 px-2"
                    title={t.defineTitle}
                >
                    <HugeiconsIcon icon={BookOpenIcon} size={14} />
                    <span className="text-xs">{t.define}</span>
                </Button>

                <Button
                    variant="ghost" size="sm"
                    onClick={onStudy}
                    className="flex-1 h-8 px-2"
                    title={t.study}
                >
                    <HugeiconsIcon icon={BookBookmark02Icon} />
                    <span className="text-xs">{t.study}</span>
                </Button>

                <Button
                    variant="ghost" size="sm"
                    onClick={onDismiss}
                    className="h-8 w-8 p-0 shrink-0"
                    title={t.close}
                >
                    <HugeiconsIcon icon={Cancel01Icon} size={14} />
                </Button>

                {/* Arrow indicator */}
                <div
                    className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent ${isAbove
                        ? 'top-full border-t-[6px] border-t-border'
                        : 'bottom-full border-b-[6px] border-b-border'
                        }`}
                    aria-hidden="true"
                />
            </div>
        </>
    );
}