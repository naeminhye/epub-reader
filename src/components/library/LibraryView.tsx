import { useEffect } from 'react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useReaderStore } from '@/stores/readerStore';
import { BookCard } from './BookCard';
import { ImportDropZone } from './ImportDropZone';
import { useT } from '@/lib/i18n/context';

export function LibraryView() {
    const { books, isLoading, loadLibrary, removeBook } = useLibraryStore();
    const openBook = useReaderStore((s) => s.openBook);
    const t = useT();

    useEffect(() => { loadLibrary(); }, [loadLibrary]);

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
            <header className="mb-8 space-y-1">
                <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.library}</h1>
                <p className="text-sm text-muted-foreground">
                    {isLoading
                        ? t.libraryLoading
                        : books.length === 0
                            ? t.libraryEmpty
                            : t.libraryBookCount(books.length)}
                </p>
            </header>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                <ImportDropZone />
                {books.map((book) => (
                    <BookCard key={book.id} book={book} onOpen={openBook} onDelete={removeBook} />
                ))}
            </div>
        </div>
    );
}