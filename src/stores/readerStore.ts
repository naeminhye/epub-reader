import { create } from 'zustand';
import type { Book, ReadingPrefs } from '@/lib/db/schema';
import { db, DEFAULT_PREFS } from '@/lib/db/schema';
import type { SelectionInfo } from '@/lib/epub/useEpubReader';

interface ReaderState {
    currentBook: Book | null;
    currentLocation: string | null;
    progress: number;
    pageInfo: { page: number; total: number } | null;
    totalLocations: number;
    prefs: ReadingPrefs;
    isReaderOpen: boolean;
    isTranslationPanelOpen: boolean;
    isSearchOpen: boolean;
    isProgressOpen: boolean;
    isTranslationSettingsOpen: boolean;
    isStudyOpen: boolean;
    isBookmarksOpen: boolean;
    selection: SelectionInfo | null;
    isWordLookupOpen: boolean;

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
    setTranslationSettingsOpen: (open: boolean) => void;
    setStudyOpen: (open: boolean) => void;
    setWordLookupOpen: (open: boolean) => void;
    setBookmarksOpen: (open: boolean) => void;
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
    isTranslationSettingsOpen: false,
    isStudyOpen: false,
    isBookmarksOpen: false,
    selection: null,
    isWordLookupOpen: false,

    openBook: (book) => {
        // Write lastReadAt immediately on open so the book qualifies as "reading"
        // even if the user never triggers a location-change event.
        const now = new Date();
        db.books.update(book.id, { lastReadAt: now }).catch(console.error);
        const updatedBook = { ...book, lastReadAt: now };
        set({
            currentBook: updatedBook,
            currentLocation: book.currentLocation ?? null,
            progress: book.progress,
            pageInfo: null,
            totalLocations: 0,
            isReaderOpen: true,
        });
    },

    closeBook: () => {
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
            isTranslationSettingsOpen: false,
            isStudyOpen: false,
            isWordLookupOpen: false,
            isBookmarksOpen: false,
        });
    },

    setLocation: (cfi, progress, pageInfo) => {
        const { currentBook } = get();
        const now = new Date();
        set((state) => ({
            currentLocation: cfi,
            progress,
            pageInfo,
            // Keep currentBook in sync so LibraryView sees the fresh progress/lastReadAt
            // without requiring a full library reload.
            currentBook: state.currentBook
                ? { ...state.currentBook, currentLocation: cfi, progress, lastReadAt: now }
                : null,
        }));
        if (currentBook) {
            db.books.update(currentBook.id, {
                currentLocation: cfi,
                progress,
                lastReadAt: now,
            }).catch(console.error);
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
    setTranslationSettingsOpen: (open) => set({ isTranslationSettingsOpen: open }),
    setStudyOpen: (open) => set({ isStudyOpen: open }),
    setWordLookupOpen: (open) => set({ isWordLookupOpen: open }),
    setBookmarksOpen: (open) => set({ isBookmarksOpen: open }),
}));
