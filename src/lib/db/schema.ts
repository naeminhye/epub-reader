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
    progress: number; // 0-1
    currentLocation?: string; // foliate CFI or section index
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
    key: string; // hash(text):sourceLang:targetLang
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
    key: string; // word:lang
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
    }

    async getPrefs(): Promise<ReadingPrefs> {
        const prefs = await this.prefs.get('singleton');
        if (prefs) {
            // Defensive migration: old prefs may have readerFont: 'lora' from earlier dev
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((prefs.readerFont as any) === 'lora') {
                const migrated = { ...prefs, readerFont: 'eb-garamond' as const };
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