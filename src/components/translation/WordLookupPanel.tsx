import { useEffect, useState } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useT } from '@/lib/i18n/context';

interface WordLookupPanelProps {
    word: string;
    open: boolean;
    onClose: () => void;
}

// Free Dictionary API response types
interface DictDefinition {
    definition: string;
    example?: string;
    synonyms?: string[];
}

interface DictMeaning {
    partOfSpeech: string;
    definitions: DictDefinition[];
}

interface DictEntry {
    word: string;
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
    meanings: DictMeaning[];
}

interface WikiSummary {
    title: string;
    extract: string;
    content_urls?: { desktop?: { page?: string } };
}

type LookupState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'dict'; entries: DictEntry[] }
    | { status: 'wiki'; summary: WikiSummary }
    | { status: 'not-found' };

export function WordLookupPanel({ word, open, onClose }: WordLookupPanelProps) {
    const t = useT();
    const [state, setState] = useState<LookupState>({ status: 'idle' });

    const query = word.trim();
    const isSingleWord = query.split(/\s+/).length === 1;

    useEffect(() => {
        if (!open || !query) return;
        setState({ status: 'loading' });

        const controller = new AbortController();

        const run = async () => {
            // Single words: try Free Dictionary API first (English only, best quality)
            if (isSingleWord) {
                try {
                    const res = await fetch(
                        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query.toLowerCase())}`,
                        { signal: controller.signal }
                    );
                    if (res.ok) {
                        const entries = await res.json() as DictEntry[];
                        if (entries?.length) {
                            setState({ status: 'dict', entries });
                            return;
                        }
                    }
                } catch (err) {
                    if ((err as Error).name === 'AbortError') return;
                }
            }

            // Fallback: Wikipedia summary (works for names, places, concepts, multi-word)
            try {
                const res = await fetch(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                    { signal: controller.signal }
                );
                if (res.ok) {
                    const data = await res.json() as WikiSummary & { type?: string };
                    if (data.type !== 'disambiguation' && data.extract?.trim()) {
                        setState({ status: 'wiki', summary: data });
                        return;
                    }
                }
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
            }

            setState({ status: 'not-found' });
        };

        run();
        return () => controller.abort();
    }, [open, query, isSingleWord]);

    // Reset when word changes
    useEffect(() => {
        setState({ status: 'idle' });
    }, [word]);

    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
    const wiktionaryUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(query.toLowerCase())}`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const jishoUrl = `https://jisho.org/search/${encodeURIComponent(query)}`;
    const isLikelyJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query);

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 h-full">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <SheetTitle className="font-heading">{t.wordLookup}</SheetTitle>
                    <p className="text-sm font-mono text-muted-foreground mt-1">"{query}"</p>
                </SheetHeader>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-5 space-y-6">

                        {/* Loading */}
                        {state.status === 'loading' && (
                            <div className="space-y-3">
                                {[0.7, 1, 0.6].map((w, i) => (
                                    <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${w * 100}%` }} />
                                ))}
                            </div>
                        )}

                        {/* Dictionary result */}
                        {state.status === 'dict' && state.entries.map((entry, ei) => (
                            <div key={ei} className="space-y-4">
                                {/* Phonetics */}
                                {(entry.phonetic || entry.phonetics?.some(p => p.text)) && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.phonetics}</p>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {(entry.phonetic ?? entry.phonetics?.find(p => p.text)?.text) && (
                                                <span className="text-sm font-mono">
                                                    {entry.phonetic ?? entry.phonetics?.find(p => p.text)?.text}
                                                </span>
                                            )}
                                            {/* Audio playback */}
                                            {entry.phonetics?.find(p => p.audio) && (
                                                <AudioButton url={entry.phonetics.find(p => p.audio)!.audio!} />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Meanings */}
                                {entry.meanings.map((meaning, mi) => (
                                    <div key={mi} className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide italic">
                                            {meaning.partOfSpeech}
                                        </p>
                                        <ol className="space-y-2 list-decimal list-outside pl-4">
                                            {meaning.definitions.slice(0, 4).map((def, di) => (
                                                <li key={di} className="text-sm leading-relaxed">
                                                    <span>{def.definition}</span>
                                                    {def.example && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{def.example}"</p>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>

                                        {/* Synonyms */}
                                        {meaning.definitions.some(d => d.synonyms?.length) && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {Array.from(new Set(meaning.definitions.flatMap(d => d.synonyms ?? []))).slice(0, 8).map(syn => (
                                                    <span key={syn} className="text-xs px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground">
                                                        {syn}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* Wikipedia result */}
                        {state.status === 'wiki' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">📖</span>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.wikiSummary}</p>
                                </div>
                                <p className="text-sm leading-relaxed">{state.summary.extract}</p>
                                {state.summary.content_urls?.desktop?.page && (
                                    <a
                                        href={state.summary.content_urls.desktop.page}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-primary underline"
                                    >
                                        {t.wikiReadMore} ↗
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Not found */}
                        {state.status === 'not-found' && (
                            <div className="text-center py-4 space-y-1">
                                <p className="text-sm text-muted-foreground">{t.wordNotFound}</p>
                                <p className="text-xs text-muted-foreground">{t.wordNotFoundHint}</p>
                            </div>
                        )}

                        {/* Search links — always shown once loaded */}
                        {(state.status === 'dict' || state.status === 'wiki' || state.status === 'not-found') && (
                            <div className="pt-2 border-t space-y-2">
                                <p className="text-xs text-muted-foreground font-medium pb-1">Search online</p>
                                <SearchLink href={googleUrl} label={t.searchGoogle} icon="🔍" />
                                <SearchLink href={wikiUrl} label={t.searchWikipedia} icon="📖" />
                                <SearchLink href={wiktionaryUrl} label="Wiktionary" icon="📚" />
                                {isLikelyJapanese && (
                                    <SearchLink href={jishoUrl} label="Jisho (Japanese)" icon="🇯🇵" />
                                )}
                                <SearchLink href={youtubeUrl} label={t.searchYouTube} icon="▶" />
                            </div>
                        )}

                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

function SearchLink({ href, label, icon }: { href: string; label: string; icon: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md border hover:bg-muted/40 transition-colors text-sm"
        >
            <span className="text-base w-5 text-center">{icon}</span>
            <span>{label}</span>
            <span className="ml-auto text-muted-foreground text-xs">↗</span>
        </a>
    );
}

function AudioButton({ url }: { url: string }) {
    const play = () => {
        try {
            const audio = new Audio(url.startsWith('//') ? `https:${url}` : url);
            audio.play();
        } catch { /* ignore */ }
    };

    return (
        <button
            type="button"
            onClick={play}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
            <span>🔊</span>
            <span>Play</span>
        </button>
    );
}