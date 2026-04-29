import { db, type Book } from './schema';

export const bookRepo = {
    async list(): Promise<Book[]> {
        return db.books.orderBy('addedAt').reverse().toArray();
    },

    async get(id: string): Promise<Book | undefined> {
        return db.books.get(id);
    },

    async add(book: Book): Promise<string> {
        await db.books.add(book);
        return book.id;
    },

    async updateProgress(id: string, progress: number, location?: string): Promise<void> {
        await db.books.update(id, {
            progress,
            currentLocation: location,
            lastReadAt: new Date(),
        });
    },

    async delete(id: string): Promise<void> {
        await db.transaction('rw', db.books, db.highlights, db.translations, async () => {
            await db.books.delete(id);
            await db.highlights.where('bookId').equals(id).delete();
            await db.translations.where('bookId').equals(id).delete();
        });
    },

    async exists(title: string, author: string): Promise<boolean> {
        const found = await db.books
            .where('title')
            .equals(title)
            .filter((b) => b.author === author)
            .first();
        return !!found;
    },
};