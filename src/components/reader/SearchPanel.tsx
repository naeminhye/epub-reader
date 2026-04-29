import { useState, useRef, useCallback } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useT } from '@/lib/i18n/context';
import type { SearchResult } from '@/lib/epub/useEpubReader';

interface SearchPanelProps {
    onSearch: (query: string) => Promise<SearchResult[]>;
    onGoTo: (cfi: string) => void;
}

export function SearchPanel({ onSearch, onGoTo }: SearchPanelProps) {
    const { isSearchOpen, setSearchOpen } = useReaderStore();
    const t = useT();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<number | undefined>(undefined);

    const handleInput = useCallback(
        (value: string) => {
            setQuery(value);
            clearTimeout(debounceRef.current);
            if (!value.trim()) { setResults([]); return; }

            debounceRef.current = window.setTimeout(async () => {
                setIsSearching(true);
                const res = await onSearch(value);
                setResults(res);
                setIsSearching(false);
            }, 400);
        },
        [onSearch]
    );

    const handleSelect = (cfi: string) => {
        onGoTo(cfi);
        setSearchOpen(false);
    };

    return (
        <Sheet open={isSearchOpen} onOpenChange={setSearchOpen}>
            <SheetContent side="left" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
                <SheetHeader className="px-4 pt-4 pb-3 border-b">
                    <SheetTitle className="font-heading">{t.search}</SheetTitle>
                    <Input
                        autoFocus
                        placeholder={t.searchInBook}
                        value={query}
                        onChange={(e) => handleInput(e.target.value)}
                        className="mt-2"
                    />
                </SheetHeader>

                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {isSearching && (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                Searching…
                            </div>
                        )}

                        {!isSearching && query && results.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                {t.noResults(query)}
                            </div>
                        )}

                        {!isSearching && results.map((result, i) => (
                            <button
                                key={`${result.cfi}-${i}`}
                                type="button"
                                onClick={() => handleSelect(result.cfi)}
                                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                            >
                                <p
                                    className="text-sm leading-relaxed line-clamp-3"
                                    // Highlight the matched query term in the excerpt
                                    dangerouslySetInnerHTML={{
                                        __html: highlightMatch(result.excerpt, query),
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </ScrollArea>

                {!isSearching && results.length > 0 && (
                    <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                        {t.resultCount(results.length)}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

function highlightMatch(excerpt: string, query: string): string {
    if (!query.trim()) return excerpt;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return excerpt.replace(
        new RegExp(`(${escaped})`, 'gi'),
        '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">$1</mark>'
    );
}