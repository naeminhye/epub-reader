import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Copy01Icon, Delete02Icon, Edit03Icon } from '@hugeicons/core-free-icons';
import { useT } from '@/lib/i18n/context';

interface TransBlockPopoverProps {
    onEdit: (transId: string, currentText: string) => void;
    onRemove: (transId: string) => void;
}

interface PopoverState {
    transId: string;
    text: string;
    rect: { top: number; bottom: number; left: number; right: number; width: number; height: number };
}

const POPOVER_WIDTH = 160;
const GAP = 8;

export function TransBlockPopover({ onEdit, onRemove }: TransBlockPopoverProps) {
    const t = useT();
    const [state, setState] = useState<PopoverState | null>(null);
    const [copied, setCopied] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type !== 'aurobie-trans-block-click') return;
            setState({ transId: e.data.transId, text: e.data.text, rect: e.data.rect });
            setCopied(false);
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const dismiss = useCallback(() => setState(null), []);

    useEffect(() => {
        if (!state) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [state, dismiss]);

    if (!state) return null;

    const { rect, transId, text } = state;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    left = Math.max(8, Math.min(left, viewportW - POPOVER_WIDTH - 8));

    const estimatedH = 44;
    let top = rect.top - estimatedH - GAP;
    const isAbove = top >= 8;
    if (!isAbove) top = rect.bottom + GAP;
    top = Math.min(top, viewportH - estimatedH - 8);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <>
            <div
                className="fixed inset-0 z-[60]"
                onMouseDown={(e) => {
                    if (!popoverRef.current?.contains(e.target as Node)) dismiss();
                }}
                aria-hidden="true"
            />
            <div
                ref={popoverRef}
                role="toolbar"
                className="fixed z-[70] flex flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden"
                style={{ top, left, width: 'fit-content', minWidth: POPOVER_WIDTH }}
                onMouseDown={(e) => e.preventDefault()}
            >
                <div className="flex items-center gap-0.5 px-1" style={{ height: 44 }}>
                    <Button variant="ghost" size="sm" onClick={handleCopy}
                        className="flex-1 h-8 gap-1 px-1.5">
                        <HugeiconsIcon icon={Copy01Icon} />
                        <span className="hidden sm:inline text-xs">{copied ? `${t.copied}!` : t.copy}</span>
                    </Button>

                    {/* Divider */}
                    <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                    <Button variant="ghost" size="sm"
                        onClick={() => { onEdit(transId, text); dismiss(); }}
                        className="flex-1 h-8 gap-1 px-1.5">
                        <HugeiconsIcon icon={Edit03Icon} />
                        <span className="hidden sm:inline text-xs">{t.edit}</span>
                    </Button>

                    {/* Divider */}
                    <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                    <Button variant="ghost" size="sm"
                        onClick={() => { onRemove(transId); dismiss(); }}
                        className="flex-1 h-8 gap-1 px-1.5 text-destructive hover:text-destructive">
                        <HugeiconsIcon icon={Delete02Icon} />
                        <span className="hidden sm:inline text-xs">{t.remove}</span>
                    </Button>

                    {/* Divider */}
                    <div className="hidden sm:inline w-px h-4 bg-border mx-0.5" />

                    <Button variant="ghost" size="sm" onClick={dismiss}
                        className="h-8 w-8 p-0 shrink-0">
                        <HugeiconsIcon icon={Cancel01Icon} size={13} />
                    </Button>
                </div>
            </div>
        </>
    );
}