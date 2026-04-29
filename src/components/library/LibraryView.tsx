import { useEffect } from 'react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useReaderStore } from '@/stores/readerStore';
import { BookCard } from './BookCard';
import { ImportDropZone } from './ImportDropZone';
import type { Book } from '@/lib/db/schema';

export function LibraryView() {
    const { books, isLoading, loadLibrary, removeBook } = useLibraryStore();
    const openBook = useReaderStore((s) => s.openBook);

    useEffect(() => {
        loadLibrary();
    }, [loadLibrary]);

    const handleOpen = (book: Book) => {
        openBook(book);
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
            <header className="mb-8 space-y-1">
                <h1 className="font-heading text-3xl font-semibold tracking-tight">Library</h1>
                <p className="text-sm text-muted-foreground">
                    {isLoading
                        ? 'Loading…'
                        : books.length === 0
                            ? 'Your library is empty. Drop an EPUB file to get started.'
                            : `${books.length} book${books.length === 1 ? '' : 's'}`}
                </p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                <ImportDropZone />
                {books.map((book) => (
                    <BookCard
                        key={book.id}
                        book={book}
                        onOpen={handleOpen}
                        onDelete={removeBook}
                    />
                ))}
            </div>
        </div>
    );
}