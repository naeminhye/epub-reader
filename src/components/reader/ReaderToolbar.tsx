import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useLocale, useT } from '@/lib/i18n/context';
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon, Menu02Icon, Moon02Icon, BookOpenIcon,
    SearchIcon, TranslateIcon, Settings02Icon,
    Sun03Icon,
    SunCloud02Icon,
    BookBookmark02Icon,
} from '@hugeicons/core-free-icons';
import type { NavItem } from 'epubjs';

interface ReaderToolbarProps {
    toc: NavItem[];
    onGoTo: (href: string) => void;
    onSearchOpen: () => void;
    onProgressOpen: () => void;
    onTranslationSettings: () => void;
    onBookmarksOpen: () => void;
    isBookmarked: boolean;
    onToggleBookmark: () => void;
}

export function ReaderToolbar({ toc, onGoTo, onSearchOpen, onProgressOpen, onTranslationSettings, onBookmarksOpen, isBookmarked, onToggleBookmark }: ReaderToolbarProps) {
    const { currentBook, closeBook, prefs, updatePrefs, progress } = useReaderStore();
    const { locale, setLocale } = useLocale();
    const t = useT();

    if (!currentBook) return null;

    const isPaginated = prefs.flowMode === 'paginated';
    const isSpread = prefs.spread === 'auto';

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
            <div className="flex items-center gap-1 px-2 py-2">

                {/* Back */}
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
                    <SheetContent side="left" className="w-80 sm:w-96 flex flex-col gap-0 p-0" style={{ overflow: 'scroll' }}>
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

                {/* Bookmark toggle */}
                <Toggle
                    pressed={isBookmarked}
                    onPressedChange={onToggleBookmark}
                    size="sm"
                    className="shrink-0 p-0 w-8 h-8 hover:bg-transparent data-[state=on]:bg-transparent"
                    title={isBookmarked ? t.bookmarkRemove : t.bookmarkAdd}
                >
                    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {isBookmarked ? (
                            /* Filled ribbon */
                            <path
                                d="M1 1h14v16.5l-7-4-7 4V1z"
                                fill="var(--accent)"
                                stroke="var(--accent)"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                            />
                        ) : (
                            /* Outline ribbon */
                            <path
                                d="M1 1h14v16.5l-7-4-7 4V1z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                            />
                        )}
                    </svg>
                </Toggle>

                {/* Center: title + progress tap target */}
                <div
                    className="flex-1 min-w-0 px-1 text-center cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={onProgressOpen}
                    title={t.readingProgress}
                >
                    <p className="text-xs text-muted-foreground truncate font-heading">{currentBook.title}</p>
                </div>

                {/* Search */}
                <Button variant="ghost" size="sm" className="shrink-0" onClick={onSearchOpen} title={t.search}>
                    <HugeiconsIcon icon={SearchIcon} size={16} />
                </Button>

                {/* Translation settings */}
                <Button variant="ghost" size="sm" className="shrink-0" title={t.translationSettings} onClick={onTranslationSettings}>
                    <HugeiconsIcon icon={TranslateIcon} />
                </Button>

                {/* Bookmarks list */}
                <Button variant="ghost" size="sm" className="shrink-0" title={t.bookmarks} onClick={onBookmarksOpen}>
                    <HugeiconsIcon icon={BookBookmark02Icon} />
                </Button>

                {/* Settings */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                            <HugeiconsIcon icon={Settings02Icon} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-3">

                        {/* ── Layout ── */}
                        <DropdownMenuLabel className="font-heading text-xs px-1">{t.layout}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />

                        {/* Flow mode — radio */}
                        <div className="px-1 py-1 space-y-1.5">
                            <span className="text-xs text-muted-foreground">{t.pageMode}</span>
                            <div className="flex rounded-md border border-input overflow-hidden">
                                {(['paginated', 'scrolled'] as const).map((mode, i) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => updatePrefs({ flowMode: mode })}
                                        className={`flex-1 text-xs py-1.5 transition-colors ${i === 0 ? '' : 'border-l border-input'}
                                            ${prefs.flowMode === mode
                                                ? 'bg-foreground text-background'
                                                : 'bg-background text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {mode === 'paginated' ? t.pages : t.scroll}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Spread — switch, paginated only */}
                        {isPaginated && (
                            <div className="flex items-center justify-between px-1 py-2">
                                <span className="text-xs">{t.twoPageSpread}</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isSpread}
                                    onClick={() => updatePrefs({ spread: isSpread ? 'none' : 'auto' })}
                                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${isSpread ? 'bg-foreground' : 'bg-muted'}`}
                                >
                                    <span className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${isSpread ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        )}

                        {/* Toolbar variant — radio */}
                        <div className="px-1 py-1 space-y-1.5">
                            <span className="text-xs text-muted-foreground">{t.toolbar}</span>
                            <div className="flex rounded-md border border-input overflow-hidden">
                                {(['persistent', 'floating'] as const).map((v, i) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => updatePrefs({ toolbarVariant: v })}
                                        className={`flex-1 text-xs py-1.5 transition-colors ${i === 0 ? '' : 'border-l border-input'}
                                            ${prefs.toolbarVariant === v
                                                ? 'bg-foreground text-background'
                                                : 'bg-background text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {v === 'persistent' ? t.toolbarPersistent : t.toolbarFloating}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Typography ── */}
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="font-heading text-xs px-1">{t.typography}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />

                        {/* Font — select */}
                        <div className="px-1 py-1 space-y-1.5">
                            <span className="text-xs text-muted-foreground">{t.font}</span>
                            <select
                                value={prefs.readerFont}
                                onChange={e => updatePrefs({ readerFont: e.target.value as typeof prefs.readerFont })}
                                className="w-full text-xs border border-input rounded-sm bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                            >
                                {([
                                    ['eb-garamond', t.fontEbGaramond],
                                    ['merriweather', t.fontMerriweather],
                                    ['montserrat', t.fontMontserrat],
                                    ['public-sans', t.fontPublicSans],
                                    ['system-serif', t.fontSystemSerif],
                                ] as const).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-3 px-1 py-1">
                            <FontSizeRow
                                label={t.fontSize} value={prefs.fontSize}
                                min={10} max={36} step={1}
                                decreaseLabel={t.decrease(t.fontSize)}
                                increaseLabel={t.increase(t.fontSize)}
                                onChange={(v) => updatePrefs({ fontSize: v })}
                            />
                            <StepperRow
                                label={t.lineHeight} value={prefs.lineHeight}
                                display={prefs.lineHeight.toFixed(1)}
                                min={1.4} max={2.2} step={0.1}
                                decreaseLabel={t.decrease(t.lineHeight)}
                                increaseLabel={t.increase(t.lineHeight)}
                                onChange={(v) => updatePrefs({ lineHeight: parseFloat(v.toFixed(1)) })}
                            />
                        </div>

                        {/* ── Appearance ── */}
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="font-heading text-xs px-1">{t.appearance}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />

                        {/* Theme — radio */}
                        <div className="px-1 py-1 space-y-1.5">
                            <span className="text-xs text-muted-foreground">{t.theme}</span>
                            <div className="flex rounded-md border border-input overflow-hidden">
                                {(['light', 'sepia', 'dark'] as const).map((theme, i) => (
                                    <button
                                        key={theme}
                                        type="button"
                                        onClick={() => updatePrefs({ theme })}
                                        className={`flex-1 text-xs py-1.5 transition-colors ${i === 0 ? '' : 'border-l border-input'}
                                            ${prefs.theme === theme
                                                ? 'bg-foreground text-background'
                                                : 'bg-background text-foreground hover:bg-muted'
                                            }`}
                                    >
                                        {theme === 'light' ?
                                            <Button
                                                variant="ghost"
                                                className="p-0"
                                                size="icon-sm"
                                            >
                                                <HugeiconsIcon icon={Sun03Icon} size={12} />
                                            </Button> : theme === 'sepia' ?
                                                <Button
                                                    variant="ghost"
                                                    className="p-0"
                                                    size="icon-sm"
                                                >
                                                    <HugeiconsIcon icon={SunCloud02Icon} size={12} />
                                                </Button> :
                                                <Button
                                                    variant="ghost"
                                                    className="p-0"
                                                    size="icon-sm"
                                                >
                                                    <HugeiconsIcon icon={Moon02Icon} size={12} />
                                                </Button>
                                        }
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language — select */}
                        <div className="px-1 py-1 space-y-1.5">
                            <span className="text-xs text-muted-foreground">{t.language}</span>
                            <select
                                value={locale}
                                onChange={e => setLocale(e.target.value as typeof locale)}
                                className="w-full text-xs border border-input rounded-sm bg-background px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value="en">English</option>
                                <option value="vi">Tiếng Việt</option>
                                <option value="ko">한국어</option>
                            </select>
                        </div>

                    </DropdownMenuContent>
                </DropdownMenu>

            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-muted">
                <div className="h-full bg-foreground/60 transition-[width] duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
        </header>
    );
}

function FontSizeRow({ label, value, min, max, step, decreaseLabel, increaseLabel, onChange }: {
    label: string; value: number; min: number; max: number; step: number;
    decreaseLabel: string; increaseLabel: string; onChange: (v: number) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <Label className="text-xs shrink-0">{label}</Label>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value - step).toFixed(10)); if (n >= min) onChange(n); }}
                    disabled={value <= min} aria-label={decreaseLabel}>−</Button>
                <input type="number" value={value} min={min} max={max} step={step}
                    onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n) && n >= min && n <= max) onChange(n); }}
                    className="h-7 w-14 text-center text-xs border border-input rounded-sm bg-background tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value + step).toFixed(10)); if (n <= max) onChange(n); }}
                    disabled={value >= max} aria-label={increaseLabel}>+</Button>
            </div>
        </div>
    );
}

function StepperRow({ label, value, display, min, max, step, decreaseLabel, increaseLabel, onChange }: {
    label: string; value: number; display: string; min: number; max: number; step: number;
    decreaseLabel: string; increaseLabel: string; onChange: (v: number) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <Label className="text-xs shrink-0">{label}</Label>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value - step).toFixed(10)); if (n >= min) onChange(n); }}
                    disabled={value <= min} aria-label={decreaseLabel}>−</Button>
                <span className="text-xs tabular-nums w-10 text-center select-none">{display}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-base font-light"
                    onClick={() => { const n = parseFloat((value + step).toFixed(10)); if (n <= max) onChange(n); }}
                    disabled={value >= max} aria-label={increaseLabel}>+</Button>
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
                    <button type="button" onClick={() => onSelect(item.href)}
                        className="w-full text-left px-2 py-2 rounded-sm text-sm hover:bg-accent transition-colors flex items-start gap-2"
                        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}>
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