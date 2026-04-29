import { create } from 'zustand';
import type { Book, ReadingPrefs } from '@/lib/db/schema';
import { db, DEFAULT_PREFS } from '@/lib/db/schema';
import type { SelectionInfo } from '@/lib/epub/useEpubReader';

interface ReaderState {
    currentBook: Book | null;
    currentLocation: string | null;
    progress: number;
    pageInfo: { page: number; total: number } | null;
    totalLocations: number;   // from book.locations.generate() — for progress panel
    prefs: ReadingPrefs;
    isReaderOpen: boolean;
    isTranslationPanelOpen: boolean;
    isSearchOpen: boolean;
    isProgressOpen: boolean;
    isStudyOpen: boolean;
    selection: SelectionInfo | null;

    openBook: (book: Book) => void;
    closeBook: () => void;
    setLocation: (cfi: string, progress: number, pageInfo: { page: number; total: number }) => void;
    setTotalLocations: (n: number) => void;
    loadPrefs: () => Promise<void>;
    updatePrefs: (patch: Partial<ReadingPrefs>) => Promise<void>;
    setTranslationPanelOpen: (open: boolean) => void;
    setSelection: (info: SelectionInfo | null) => void;
    setSearchOpen: (open: boolean) => void;
    setProgressOpen: (open: boolean) => void;
    setStudyOpen: (open: boolean) => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
    currentBook: null,
    currentLocation: null,
    progress: 0,
    pageInfo: null,
    totalLocations: 0,
    prefs: DEFAULT_PREFS,
    isReaderOpen: false,
    isTranslationPanelOpen: false,
    isSearchOpen: false,
    isProgressOpen: false,
    isStudyOpen: false,
    selection: null,

    openBook: (book) =>
        set({
            currentBook: book,
            currentLocation: book.currentLocation ?? null,
            progress: book.progress,
            pageInfo: null,
            totalLocations: 0,
            isReaderOpen: true,
        }),

    closeBook: () =>
        set({
            currentBook: null,
            currentLocation: null,
            progress: 0,
            pageInfo: null,
            totalLocations: 0,
            isReaderOpen: false,
            isTranslationPanelOpen: false,
            selection: null,
            isSearchOpen: false,
            isProgressOpen: false,
            isStudyOpen: false,
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

    setTotalLocations: (n) => set({ totalLocations: n }),

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
    setProgressOpen: (open) => set({ isProgressOpen: open }),
    setStudyOpen: (open) => set({ isStudyOpen: open }),
}));