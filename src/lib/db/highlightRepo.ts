import { db, type Highlight } from './schema';

export const highlightRepo = {
    async listForBook(bookId: string): Promise<Highlight[]> {
        return db.highlights.where('bookId').equals(bookId).sortBy('createdAt');
    },

    async add(highlight: Highlight): Promise<void> {
        await db.highlights.add(highlight);
    },

    async updateNote(id: string, note: string): Promise<void> {
        await db.highlights.update(id, { note });
    },

    async delete(id: string): Promise<void> {
        await db.highlights.delete(id);
    },

    async deleteByCfi(bookId: string, cfi: string): Promise<void> {
        await db.highlights
            .where('bookId').equals(bookId)
            .and((h) => h.cfi === cfi)
            .delete();
    },
};