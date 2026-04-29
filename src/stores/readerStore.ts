import { create } from 'zustand';
import type { Book, ReadingPrefs } from '@/lib/db/schema';
import { db, DEFAULT_PREFS } from '@/lib/db/schema';
import type { SelectionInfo } from '@/lib/epub/useEpubReader';

interface ReaderState {
    currentBook: Book | null;
    currentLocation: string | null;
    progress: number;
    pageInfo: { page: number; total: number } | null;
    prefs: ReadingPrefs;
    isReaderOpen: boolean;
    isTranslationPanelOpen: boolean;
    selection: SelectionInfo | null;
    isSearchOpen: boolean;

    openBook: (book: Book) => void;
    closeBook: () => void;
    setLocation: (cfi: string, progress: number, pageInfo: { page: number; total: number }) => void;
    loadPrefs: () => Promise<void>;
    updatePrefs: (patch: Partial<ReadingPrefs>) => Promise<void>;
    setTranslationPanelOpen: (open: boolean) => void;
    setSelection: (info: SelectionInfo | null) => void;
    setSearchOpen: (open: boolean) => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
    currentBook: null,
    currentLocation: null,
    progress: 0,
    pageInfo: null,
    prefs: DEFAULT_PREFS,
    isReaderOpen: false,
    isTranslationPanelOpen: false,
    selection: null,
    isSearchOpen: false,

    openBook: (book) =>
        set({
            currentBook: book,
            currentLocation: book.currentLocation ?? null,
            progress: book.progress,
            pageInfo: null,
            isReaderOpen: true,
        }),

    closeBook: () =>
        set({
            currentBook: null,
            currentLocation: null,
            progress: 0,
            pageInfo: null,
            isReaderOpen: false,
            isTranslationPanelOpen: false,
            selection: null,
            isSearchOpen: false,
        }),

    setLocation: (cfi, progress, pageInfo) => {
        const { currentBook } = get();
        set({ currentLocation: cfi, progress, pageInfo });
        if (currentBook) {
            db.books.update(currentBook.id, {
                currentLocation: cfi,
                progress,
                lastReadAt: new Date(),
            });
        }
    },

    loadPrefs: async () => {
        const prefs = await db.getPrefs();
        set({ prefs });
    },

    updatePrefs: async (patch) => {
        const updated = await db.updatePrefs(patch);
        set({ prefs: updated });
    },

    setTranslationPanelOpen: (open) => set({ isTranslationPanelOpen: open }),
    setSelection: (info) => set({ selection: info }),
    setSearchOpen: (open) => set({ isSearchOpen: open }),
}));