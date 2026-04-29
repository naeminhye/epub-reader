import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowLeft01Icon,
    Menu02Icon,
    TextFontIcon,
    Sun01Icon,
    Moon02Icon,
    BookOpenIcon,
} from '@hugeicons/core-free-icons';
import type { NavItem } from 'epubjs';

interface ReaderToolbarProps {
    toc: NavItem[];
    onGoTo: (href: string) => void;
}

export function ReaderToolbar({ toc, onGoTo }: ReaderToolbarProps) {
    const { currentBook, closeBook, prefs, updatePrefs, progress } = useReaderStore();

    if (!currentBook) return null;

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2 px-3 py-2">
                <Button variant="ghost" size="sm" onClick={closeBook} className="shrink-0">
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                    <span className="hidden sm:inline ml-1">Library</span>
                </Button>

                {/* TOC drawer */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                            <HugeiconsIcon icon={Menu02Icon} size={16} />
                            <span className="hidden sm:inline ml-1">Contents</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 sm:w-96">
                        <SheetHeader>
                            <SheetTitle className="font-heading">Contents</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-[calc(100vh-5rem)] mt-4 -mx-6 px-6">
                            <TocList items={toc} onSelect={onGoTo} />
                        </ScrollArea>
                    </SheetContent>
                </Sheet>

                {/* Center: title */}
                <div className="flex-1 min-w-0 px-2 text-center">
                    <p className="text-xs text-muted-foreground truncate font-heading">
                        {currentBook.title}
                    </p>
                </div>

                {/* Theme toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                        const next =
                            prefs.theme === 'light' ? 'sepia' : prefs.theme === 'sepia' ? 'dark' : 'light';
                        updatePrefs({ theme: next });
                    }}
                >
                    <HugeiconsIcon
                        icon={prefs.theme === 'dark' ? Moon02Icon : Sun01Icon}
                        size={16}
                    />
                </Button>

                {/* Typography menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                            <HugeiconsIcon icon={TextFontIcon} size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-3">
                        <DropdownMenuLabel className="font-heading">Typography</DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2" />

                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Font size</Label>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {prefs.fontSize}px
                                    </span>
                                </div>
                                <Slider
                                    min={14}
                                    max={28}
                                    step={1}
                                    value={[prefs.fontSize]}
                                    onValueChange={([v]) => updatePrefs({ fontSize: v })}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Line height</Label>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {prefs.lineHeight.toFixed(1)}
                                    </span>
                                </div>
                                <Slider
                                    min={1.4}
                                    max={2.2}
                                    step={0.1}
                                    value={[prefs.lineHeight]}
                                    onValueChange={([v]) => updatePrefs({ lineHeight: v })}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Page width</Label>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {prefs.maxWidthCh}ch
                                    </span>
                                </div>
                                <Slider
                                    min={50}
                                    max={90}
                                    step={5}
                                    value={[prefs.maxWidthCh]}
                                    onValueChange={([v]) => updatePrefs({ maxWidthCh: v })}
                                />
                            </div>
                        </div>

                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Font family
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => updatePrefs({ readerFont: 'eb-garamond' })}
                            className={prefs.readerFont === 'eb-garamond' ? 'bg-accent' : ''}
                        >
                            EB Garamond
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => updatePrefs({ readerFont: 'merriweather' })}
                            className={prefs.readerFont === 'merriweather' ? 'bg-accent' : ''}
                        >
                            Merriweather
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => updatePrefs({ readerFont: 'system-serif' })}
                            className={prefs.readerFont === 'system-serif' ? 'bg-accent' : ''}
                        >
                            System serif
                        </DropdownMenuItem>
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

function TocList({
    items,
    onSelect,
    depth = 0,
}: {
    items: NavItem[];
    onSelect: (href: string) => void;
    depth?: number;
}) {
    return (
        <ul className="space-y-0.5">
            {items.map((item) => (
                <li key={item.id}>
                    <button
                        type="button"
                        onClick={() => onSelect(item.href)}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors flex items-start gap-2"
                        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                    >
                        <HugeiconsIcon
                            icon={BookOpenIcon}
                            size={12}
                            className="mt-0.5 shrink-0 text-muted-foreground"
                        />
                        <span className="line-clamp-2 leading-snug">{item.label.trim()}</span>
                    </button>
                    {item.subitems && item.subitems.length > 0 && (
                        <TocList items={item.subitems} onSelect={onSelect} depth={depth + 1} />
                    )}
                </li>
            ))}
        </ul>
    );
}