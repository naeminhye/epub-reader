import { create } from 'zustand';
import type { Book, BookFormat } from '@/lib/db/schema';
import { bookRepo } from '@/lib/db/bookRepo';
import { extractEpubMetadata } from '@/lib/epub/metadata';
import { extractPdfMetadata, extractCbzMetadata, extractTxtMetadata } from '@/lib/epub/formatMetadata';

interface LibraryState {
    books: Book[];
    isLoading: boolean;
    isImporting: boolean;
    importError: string | null;

    loadLibrary: () => Promise<void>;
    importBook: (file: File) => Promise<Book | null>;
    /** @deprecated use importBook */
    importEpub: (file: File) => Promise<Book | null>;
    removeBook: (id: string) => Promise<void>;
}

const SUPPORTED: Record<string, BookFormat> = {
    '.epub': 'epub',
    '.pdf': 'pdf',
    '.cbz': 'cbz',
    '.txt': 'txt',
    '.md': 'txt',
    '.text': 'txt',
};

const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

function detectFormat(file: File): BookFormat | null {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return SUPPORTED[ext] ?? null;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    books: [],
    isLoading: false,
    isImporting: false,
    importError: null,

    loadLibrary: async () => {
        set({ isLoading: true });
        try {
            const books = await bookRepo.list();
            set({ books, isLoading: false });
        } catch (err) {
            console.error('Failed to load library', err);
            set({ isLoading: false });
        }
    },

    importBook: async (file) => {
        set({ isImporting: true, importError: null });
        try {
            const format = detectFormat(file);
            if (!format) throw new Error(`Unsupported file type. Supported: EPUB, PDF, CBZ, TXT, MD`);
            if (file.size > MAX_SIZE) throw new Error('File too large (max 500 MB)');

            // Extract metadata based on format
            const meta = format === 'epub' ? await extractEpubMetadata(file)
                : format === 'pdf' ? await extractPdfMetadata(file)
                    : format === 'cbz' ? await extractCbzMetadata(file)
                        : await extractTxtMetadata(file);

            // Deduplicate
            const exists = await bookRepo.exists(meta.title, meta.author);
            if (exists) throw new Error(`"${meta.title}" is already in your library`);

            const book: Book = {
                id: crypto.randomUUID(),
                title: meta.title,
                author: meta.author,
                language: meta.language,
                coverBlob: meta.coverBlob,
                fileBlob: file,
                format,
                fileSize: file.size,
                addedAt: new Date(),
                progress: 0,
            };

            await bookRepo.add(book);
            const books = await bookRepo.list();
            set({ books, isImporting: false });
            return book;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Import failed';
            set({ importError: message, isImporting: false });
            return null;
        }
    },

    // Backwards compat — some components still call importEpub
    importEpub: async (file) => {
        const { importBook } = get();
        return importBook(file);
    },

    removeBook: async (id) => {
        await bookRepo.delete(id);
        const books = await bookRepo.list();
        set({ books });
    },
}));