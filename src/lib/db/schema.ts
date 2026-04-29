import Dexie, { type Table } from 'dexie';

export interface Book {
    id: string;
    title: string;
    author: string;
    language?: string;
    coverBlob?: Blob;
    epubBlob: Blob;
    fileSize: number;
    addedAt: Date;
    lastReadAt?: Date;
    progress: number;
    currentLocation?: string;
}

/** Derived from progress — not stored, computed at read time */
export function bookStatus(book: Book): 'new' | 'reading' | 'done' {
    if (book.progress >= 0.95) return 'done';
    if (book.progress > 0 || book.lastReadAt) return 'reading';
    return 'new';
}

export interface Highlight {
    id: string;
    bookId: string;
    text: string;
    cfi: string;
    color: 'yellow' | 'blue' | 'green' | 'pink';
    note?: string;
    createdAt: Date;
}

export interface TranslationCache {
    key: string;
    sourceText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    bookId?: string;
    createdAt: Date;
}

export interface Definition {
    partOfSpeech: string;
    meaning: string;
    example?: string;
}

export interface DictionaryCache {
    key: string;
    word: string;
    lang: string;
    definitions: Definition[];
    vietnameseGloss?: string;
    phonetic?: string;
    createdAt: Date;
}

export interface ReadingPrefs {
    id: 'singleton';
    fontSize: number;
    lineHeight: number;
    theme: 'light' | 'sepia' | 'dark';
    readerFont: 'eb-garamond' | 'merriweather' | 'system-serif';
    translationMode: 'on-demand' | 'auto-tap';
    targetLang: 'vi';
    maxWidthCh: number;
    flowMode: 'paginated' | 'scrolled';
    spread: 'none' | 'auto';
    autoTranslate: boolean;        // translate entire page on load
    showOriginal: boolean;         // in auto-translate mode, show original text alongside
}

export const DEFAULT_PREFS: ReadingPrefs = {
    id: 'singleton',
    fontSize: 18,
    lineHeight: 1.7,
    theme: 'light',
    readerFont: 'eb-garamond',
    translationMode: 'on-demand',
    targetLang: 'vi',
    maxWidthCh: 65,
    flowMode: 'paginated',
    spread: 'none',
    autoTranslate: false,
    showOriginal: false,
};

export class EpubReaderDB extends Dexie {
    books!: Table<Book, string>;
    highlights!: Table<Highlight, string>;
    translations!: Table<TranslationCache, string>;
    dictionary!: Table<DictionaryCache, string>;
    prefs!: Table<ReadingPrefs, string>;

    constructor() {
        super('EpubReaderVI');

        this.version(1).stores({
            books: 'id, title, author, lastReadAt, addedAt',
            highlights: 'id, bookId, cfi, createdAt',
            translations: 'key, bookId, createdAt',
            dictionary: 'key, word, createdAt',
            prefs: 'id',
        });

        // Version 2: adds flowMode + spread to prefs (auto-migrated — new fields just default)
        this.version(2).stores({
            books: 'id, title, author, lastReadAt, addedAt',
            highlights: 'id, bookId, cfi, createdAt',
            translations: 'key, bookId, createdAt',
            dictionary: 'key, word, createdAt',
            prefs: 'id',
        });

        // Version 3: adds autoTranslate + showOriginal to prefs
        this.version(3).stores({
            books: 'id, title, author, lastReadAt, addedAt',
            highlights: 'id, bookId, cfi, createdAt',
            translations: 'key, bookId, createdAt',
            dictionary: 'key, word, createdAt',
            prefs: 'id',
        });
    }

    async getPrefs(): Promise<ReadingPrefs> {
        const prefs = await this.prefs.get('singleton');
        if (prefs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = prefs as any;
            const patch: Partial<ReadingPrefs> = {};
            if (p.readerFont === 'lora') patch.readerFont = 'eb-garamond';
            if (!p.flowMode) patch.flowMode = 'paginated';
            if (!p.spread) patch.spread = 'none';
            if (p.autoTranslate === undefined) patch.autoTranslate = false;
            if (p.showOriginal === undefined) patch.showOriginal = false;
            if (Object.keys(patch).length) {
                const migrated = { ...prefs, ...patch } as ReadingPrefs;
                await this.prefs.put(migrated);
                return migrated;
            }
            return prefs;
        }
        await this.prefs.put(DEFAULT_PREFS);
        return DEFAULT_PREFS;
    }

    async updatePrefs(patch: Partial<ReadingPrefs>): Promise<ReadingPrefs> {
        const current = await this.getPrefs();
        const updated = { ...current, ...patch, id: 'singleton' as const };
        await this.prefs.put(updated);
        return updated;
    }
}

export const db = new EpubReaderDB();