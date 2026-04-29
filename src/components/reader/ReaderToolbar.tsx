import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useLocale, useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    Menu02Icon,
    Moon02Icon,
    Sun01Icon,
    BookOpenIcon,
    SearchIcon,
    Settings01Icon,
} from '@hugeicons/core-free-icons';
import type { NavItem } from 'epubjs';

interface ReaderToolbarProps {
    toc: NavItem[];
    onGoTo: (href: string) => void;
    onSearchOpen: () => void;
    onProgressOpen: () => void;
}

export function ReaderToolbar({ toc, onGoTo, onSearchOpen, onProgressOpen }: ReaderToolbarProps) {
    const { currentBook, closeBook, prefs, updatePrefs, progress, pageInfo } = useReaderStore();
    const { locale, setLocale } = useLocale();
    const t = useT();

    if (!currentBook) return null;

    const isPaginated = prefs.flowMode === 'paginated';
    const isSpread = prefs.spread === 'auto';

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
            <div className="flex items-center gap-1 px-2 py-2">

                {/* Back to library */}
                <Button variant="ghost" size="sm" onClick={closeBook} className="shrink-0 gap-1">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                    <span className="hidden sm:inline text-xs">{t.library}</span>
                </Button>

                {/* TOC */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                            <HugeiconsIcon icon={Menu02Icon} size={16} />
                            <span className="hidden sm:inline text-xs ml-1">{t.contents}</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 sm:w-96 flex flex-col gap-0 p-0">
                        <SheetHeader className="px-6 py-4 border-b">
                            <SheetTitle className="font-heading">{t.contents}</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="flex-1">
                            <div className="px-4 py-2">
                                <TocList items={toc} onSelect={onGoTo} />
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>

                {/* Search */}
                <Button variant="ghost" size="sm" className="shrink-0" onClick={onSearchOpen} title={t.search}>
                    <HugeiconsIcon icon={SearchIcon} size={16} />
                </Button>

                {/* Center: title + page position + progress tap target */}
                <div
                    className="flex-1 min-w-0 px-1 text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={onProgressOpen}
                    title={t.readingProgress}
                >
                    <p className="text-xs text-muted-foreground truncate font-heading">{currentBook.title}</p>
                    {isPaginated && pageInfo && pageInfo.total > 1 && (
                        <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                            {pageInfo.page} / {pageInfo.total}
                        </p>
                    )}
                </div>

                {/* Auto-translate toggle */}
                <Button
                    variant={prefs.autoTranslate ? 'secondary' : 'ghost'}
                    size="sm"
                    className="shrink-0 text-xs font-normal"
                    title={prefs.autoTranslate ? t.autoTranslateOn : t.autoTranslateOff}
                    onClick={() => updatePrefs({ autoTranslate: !prefs.autoTranslate })}
                >
                    {t.autoTranslate}
                </Button>

                {/* Show/hide original — only visible when autoTranslate is on */}
                {prefs.autoTranslate && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs font-normal"
                        onClick={() => updatePrefs({ showOriginal: !prefs.showOriginal })}
                    >
                        {prefs.showOriginal ? t.hideOriginal : t.showOriginal}
                    </Button>
                )}

                {/* Flow mode toggle */}
                <Button
                    variant="ghost" size="sm"
                    className="shrink-0 text-xs font-normal"
                    title={isPaginated ? t.switchToScroll : t.switchToPages}
                    onClick={() => updatePrefs({ flowMode: isPaginated ? 'scrolled' : 'paginated' })}
                >
                    {isPaginated ? t.scroll : t.pages}
                </Button>

                {/* Spread toggle — paginated only */}
                {isPaginated && (
                    <Button
                        variant="ghost" size="sm"
                        className="shrink-0 text-xs font-normal"
                        onClick={() => updatePrefs({ spread: isSpread ? 'none' : 'auto' })}
                    >
                        {isSpread ? t.singlePage : t.doublePage}
                    </Button>
                )}

                {/* Theme toggle */}
                <Button
                    variant="ghost" size="sm" className="shrink-0"
                    title={t.themeLabel(prefs.theme)}
                    onClick={() => {
                        const next = prefs.theme === 'light' ? 'sepia' : prefs.theme === 'sepia' ? 'dark' : 'light';
                        updatePrefs({ theme: next });
                    }}
                >
                    <HugeiconsIcon icon={prefs.theme === 'dark' ? Moon02Icon : Sun01Icon} size={16} />
                </Button>

                {/* App language toggle — cycles EN → VI → KO */}
                <Button
                    variant="ghost" size="sm"
                    className="shrink-0 text-xs font-normal"
                    title={t.language}
                    onClick={() => {
                        const next: Record<string, Locale> = { en: 'vi', vi: 'ko', ko: 'en' };
                        setLocale(next[locale] ?? 'en');
                    }}
                >
                    {locale.toUpperCase()}
                </Button>

                {/* Settings: typography + target language */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                            <HugeiconsIcon icon={Settings01Icon} size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-3">
                        <DropdownMenuLabel className="font-heading">{t.typography}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />
                        <div className="space-y-3 py-1">
                            <StepperRow
                                label={t.fontSize}
                                value={prefs.fontSize}
                                display={`${prefs.fontSize}px`}
                                min={14} max={28} step={1}
                                decreaseLabel={t.decrease(t.fontSize)}
                                increaseLabel={t.increase(t.fontSize)}
                                onChange={(v) => updatePrefs({ fontSize: v })}
                            />
                            <StepperRow
                                label={t.lineHeight}
                                value={prefs.lineHeight}
                                display={prefs.lineHeight.toFixed(1)}
                                min={1.4} max={2.2} step={0.1}
                                decreaseLabel={t.decrease(t.lineHeight)}
                                increaseLabel={t.increase(t.lineHeight)}
                                onChange={(v) => updatePrefs({ lineHeight: parseFloat(v.toFixed(1)) })}
                            />
                        </div>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.font}</DropdownMenuLabel>
                        {(
                            [
                                ['eb-garamond', t.fontEbGaramond],
                                ['merriweather', t.fontMerriweather],
                                ['system-serif', t.fontSystemSerif],
                            ] as const
                        ).map(([val, label]) => (
                            <DropdownMenuItem
                                key={val}
                                onClick={() => updatePrefs({ readerFont: val })}
                                className={prefs.readerFont === val ? 'bg-accent' : ''}
                            >
                                {label}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.targetLanguage}</DropdownMenuLabel>
                        {(
                            ['vi', 'en', 'ko', 'zh', 'ja', 'fr', 'de', 'es'] as const
                        ).map((lang) => (
                            <DropdownMenuItem
                                key={lang}
                                onClick={() => updatePrefs({ targetLang: lang })}
                                className={prefs.targetLang === lang ? 'bg-accent' : ''}
                            >
                                {t.targetLanguageName(lang)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-muted">
                <div
                    className="h-full bg-foreground/60 transition-[width] duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                />
            </div>
        </header>
    );
}

function StepperRow({
    label, value, display, min, max, step, decreaseLabel, increaseLabel, onChange,
}: {
    label: string; value: number; display: string;
    min: number; max: number; step: number;
    decreaseLabel: string; increaseLabel: string;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <Label className="text-xs shrink-0">{label}</Label>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value - step).toFixed(10)); if (n >= min) onChange(n); }}
                    disabled={value <= min} aria-label={decreaseLabel}
                >−</Button>
                <span className="text-xs tabular-nums w-10 text-center select-none">{display}</span>
                <Button
                    variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value + step).toFixed(10)); if (n <= max) onChange(n); }}
                    disabled={value >= max} aria-label={increaseLabel}
                >+</Button>
            </div>
        </div>
    );
}

function TocList({ items, onSelect, depth = 0 }: { items: NavItem[]; onSelect: (href: string) => void; depth?: number }) {
    if (!items?.length) return null;
    return (
        <ul className="space-y-0.5">
            {items.map((item) => (
                <li key={item.id ?? item.href}>
                    <button
                        type="button"
                        onClick={() => onSelect(item.href)}
                        className="w-full text-left px-2 py-2 rounded-sm text-sm hover:bg-accent transition-colors flex items-start gap-2"
                        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                    >
                        <HugeiconsIcon icon={BookOpenIcon} size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2 leading-snug">{item.label?.trim()}</span>
                    </button>
                    {item.subitems && item.subitems.length > 0 && (
                        <TocList items={item.subitems} onSelect={onSelect} depth={depth + 1} />
                    )}
                </li>
            ))}
        </ul>
    );
}