import { useEffect } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useT } from '@/lib/i18n/context';
import { toast } from 'sonner';

export function TranslationPanel() {
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

                        {selection?.text && (
                            <section>
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                    {t.original}
                                </h3>
                                <p className="text-sm leading-relaxed text-foreground/80" style={{ fontFamily: 'var(--font-sans, inherit)' }}>
                                    {selection.text}
                                </p>
                            </section>
                        )}

                        <section>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t.translationLangLabel(targetLang)}
                                </h3>
                                {result && !isLoading && (
                                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 -mr-2">
                                        <span className="text-xs">{t.copy}</span>
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
                                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                                    <p className="text-sm text-destructive">{error}</p>
                                    <Button variant="outline" size="sm" className="h-8"
                                        onClick={() => selection?.text && translate({ text: selection.text, targetLang, bookId: currentBook?.id })}>
                                        <span className="text-xs">{t.retry}</span>
                                    </Button>
                                </div>
                            )}

                            {result && !isLoading && (
                                <p className="text-base leading-relaxed">
                                    {result.translation}
                                </p>
                            )}
                        </section>

                        {result && !isLoading && (
                            <div className="pt-4 border-t text-xs text-muted-foreground">
                                {result.cached ? t.fromCacheLabel : t.translatedBy(result.model ?? 'Gemini')}
                            </div>
                        )}

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}