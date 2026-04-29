import { create } from 'zustand';
import type { Book, ReadingPrefs } from '@/lib/db/schema';
import { db, DEFAULT_PREFS } from '@/lib/db/schema';

interface ReaderState {
    // Active book session
    currentBook: Book | null;
    currentLocation: string | null;
    progress: number;

    // Prefs (mirrored from IndexedDB for fast access)
    prefs: ReadingPrefs;

    // UI state
    isReaderOpen: boolean;
    isTranslationPanelOpen: boolean;
    selectedText: string | null;

    // Actions
    openBook: (book: Book) => void;
    closeBook: () => void;
    setLocation: (location: string, progress: number) => void;
    loadPrefs: () => Promise<void>;
    updatePrefs: (patch: Partial<ReadingPrefs>) => Promise<void>;
    setTranslationPanelOpen: (open: boolean) => void;
    setSelectedText: (text: string | null) => void;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
    currentBook: null,
    currentLocation: null,
    progress: 0,
    prefs: DEFAULT_PREFS,
    isReaderOpen: false,
    isTranslationPanelOpen: false,
    selectedText: null,

    openBook: (book) =>
        set({
            currentBook: book,
            currentLocation: book.currentLocation ?? null,
            progress: book.progress,
            isReaderOpen: true,
        }),

    closeBook: () =>
        set({
            currentBook: null,
            currentLocation: null,
            progress: 0,
            isReaderOpen: false,
            isTranslationPanelOpen: false,
            selectedText: null,
        }),

    setLocation: (location, progress) => {
        const { currentBook } = get();
        set({ currentLocation: location, progress });
        if (currentBook) {
            // Persist progress; fire-and-forget
            db.books.update(currentBook.id, {
                currentLocation: location,
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
    setSelectedText: (text) => set({ selectedText: text }),
}));