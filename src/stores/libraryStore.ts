import { create } from 'zustand';
import type { Book } from '@/lib/db/schema';
import { bookRepo } from '@/lib/db/bookRepo';
import { extractEpubMetadata } from '@/lib/epub/metadata';

interface LibraryState {
    books: Book[];
    isLoading: boolean;
    isImporting: boolean;
    importError: string | null;

    loadLibrary: () => Promise<void>;
    importEpub: (file: File) => Promise<Book | null>;
    removeBook: (id: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set) => ({
    books: [],
    isLoading: false,
    isImporting: false,
    importError: null,

    loadLibrary: async () => {
        set({ isLoading: true });
        try {
            const books = await bookRepo.list();

            books.sort((a, b) => {
            const aTime = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
            const bTime = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
            return bTime - aTime;
            });

            set({ books, isLoading: false });
        } catch (err) {
            console.error('Failed to load library', err);
            set({ isLoading: false });
        }
    },

    importEpub: async (file) => {
        set({ isImporting: true, importError: null });
        try {
            // Validate extension
            if (!file.name.toLowerCase().endsWith('.epub')) {
                throw new Error('Please select a .epub file');
            }

            // Validate size (sanity cap at 200MB)
            if (file.size > 200 * 1024 * 1024) {
                throw new Error('File too large (max 200MB)');
            }

            // Extract metadata
            const meta = await extractEpubMetadata(file);

            // Check for duplicate
            const exists = await bookRepo.exists(meta.title, meta.author);
            if (exists) {
                throw new Error(`"${meta.title}" by ${meta.author} is already in your library`);
            }

            // Build book record
            const book: Book = {
                id: crypto.randomUUID(),
                title: meta.title,
                author: meta.author,
                language: meta.language,
                coverBlob: meta.coverBlob,
                epubBlob: file,
                fileSize: file.size,
                addedAt: new Date(),
                progress: 0,
            };

            await bookRepo.add(book);

            // Refresh library
            const books = await bookRepo.list();
            set({ books, isImporting: false });
            return book;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Import failed';
            set({ importError: message, isImporting: false });
            return null;
        }
    },

    removeBook: async (id) => {
        await bookRepo.delete(id);
        const books = await bookRepo.list();
        set({ books });
    },
}));