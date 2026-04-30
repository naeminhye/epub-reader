import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CopyIcon, Settings01Icon } from '@hugeicons/core-free-icons';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useT } from '@/lib/i18n/context';
import { type TranslationErrorCode } from '@/lib/translation/client';
import { toast } from 'sonner';

interface TranslationPanelProps {
    onOpenSettings: () => void;
}

export function TranslationPanel({ onOpenSettings }: TranslationPanelProps) {
    const { isTranslationPanelOpen, setTranslationPanelOpen, selection, currentBook, prefs } = useReaderStore();
    const { translate, result, isLoading, error, reset } = useTranslation();
    const t = useT();

    const targetLang = prefs.targetLang ?? 'vi';

    useEffect(() => {
        if (isTranslationPanelOpen && selection?.text) {
            translate({ text: selection.text, targetLang, bookId: currentBook?.id });
        }
    }, [isTranslationPanelOpen, selection?.text, currentBook?.id, targetLang]); // eslint-disable-line

    useEffect(() => {
        if (!isTranslationPanelOpen) reset();
    }, [isTranslationPanelOpen]); // eslint-disable-line

    const handleCopy = async () => {
        if (!result?.translation) return;
        try {
            await navigator.clipboard.writeText(result.translation);
            toast.success(t.copied);
        } catch {
            toast.error(t.couldNotCopy);
        }
    };

    return (
        <Sheet open={isTranslationPanelOpen} onOpenChange={setTranslationPanelOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 h-full">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <SheetTitle className="font-heading">{t.translationTitle}</SheetTitle>
                    <SheetDescription className="text-xs">
                        {result?.cached
                            ? t.fromCache
                            : isLoading
                                ? t.translating
                                : error
                                    ? t.translationError
                                    : t.translationLangLabel(targetLang)}
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-5 space-y-6">

                        {/* Original text */}
                        {selection?.text && (
                            <section>
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                    {t.original}
                                </h3>
                                <p className="text-sm leading-relaxed text-foreground/80">
                                    {selection.text}
                                </p>
                            </section>
                        )}

                        {/* Translation section */}
                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t.translationLangLabel(targetLang)}
                                </h3>
                                {result && !isLoading && (
                                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 -mr-2" title={t.copy}>
                                        <span className="text-xs"><HugeiconsIcon icon={CopyIcon} /></span>
                                    </Button>
                                )}
                            </div>

                            {isLoading && (
                                <div className="space-y-2">
                                    {[3, 4, 3].map((w, i) => (
                                        <div key={i} className={`h-4 bg-muted rounded animate-pulse w-${w}/4`} />
                                    ))}
                                </div>
                            )}

                            {error && (
                                <TranslationErrorBlock
                                    error={error}
                                    onRetry={() => selection?.text && translate({ text: selection.text, targetLang, bookId: currentBook?.id })}
                                    onOpenSettings={onOpenSettings}
                                />
                            )}

                            {result && !isLoading && (
                                <p className="text-base leading-relaxed">
                                    {result.translation}
                                </p>
                            )}
                        </section>

                        {/* Footer metadata */}
                        {result && !isLoading && (
                            <div className="pt-4 border-t text-xs text-muted-foreground flex items-center justify-between">
                                <span>
                                    {result.cached
                                        ? t.fromCacheLabel
                                        : t.translatedBy(`${result.model ?? 'AI'} via ${result.provider ?? 'Gemini'}`)}
                                </span>
                                <Button
                                    variant="ghost" size="sm" className="h-6 text-xs px-2 -mr-2 text-muted-foreground"
                                    onClick={onOpenSettings}
                                >
                                    <HugeiconsIcon icon={Settings01Icon} />
                                </Button>
                            </div>
                        )}

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

function TranslationErrorBlock({
    error, onRetry, onOpenSettings,
}: {
    error: string;
    onRetry: () => void;
    onOpenSettings: () => void;
}) {
    const t = useT();

    // Map error message to canonical display + whether to show settings button
    const { displayMsg, showSettings } = mapErrorDisplay(error, t);

    return (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
                <span className="text-destructive text-base leading-none mt-0.5">⚠</span>
                <p className="text-sm text-destructive font-medium">{displayMsg}</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry}>
                    {t.retry}
                </Button>
                {showSettings && (
                    <Button variant="default" size="sm" className="h-8 text-xs" onClick={onOpenSettings}>
                        {t.errGoToSettings}
                    </Button>
                )}
            </div>
        </div>
    );
}

function mapErrorDisplay(
    error: string,
    t: ReturnType<typeof useT>
): { displayMsg: string; code: TranslationErrorCode; showSettings: boolean } {
    const msg = error.toLowerCase();
    if (msg.includes('invalid key') || msg.includes('invalid_key')) {
        return { displayMsg: t.errInvalidKey, code: 'invalid_key', showSettings: true };
    }
    if (msg.includes('too many') || msg.includes('rate limit') || msg.includes('429')) {
        return { displayMsg: t.errRateLimited, code: 'rate_limited', showSettings: false };
    }
    if (msg.includes('blocked') || msg.includes('403')) {
        return { displayMsg: t.errKeyBlocked, code: 'key_blocked', showSettings: true };
    }
    if (msg.includes('network') || msg.includes('reach') || msg.includes('connect')) {
        return { displayMsg: t.errNetwork, code: 'network', showSettings: false };
    }
    if (msg.includes('all models')) {
        return { displayMsg: t.errAllModelsFailed, code: 'all_models_failed', showSettings: true };
    }
    return { displayMsg: t.errUnknown, code: 'unknown', showSettings: true };
}