import { db, type StudyEntry } from './schema';

export const studyRepo = {
    async listAll(): Promise<StudyEntry[]> {
        return db.study.orderBy('createdAt').reverse().toArray();
    },

    async listForBook(bookId: string): Promise<StudyEntry[]> {
        return db.study.where('bookId').equals(bookId).reverse().sortBy('createdAt');
    },

    async add(entry: StudyEntry): Promise<void> {
        await db.study.add(entry);
    },

    async updateNote(id: string, note: string): Promise<void> {
        await db.study.update(id, { note });
    },

    async delete(id: string): Promise<void> {
        await db.study.delete(id);
    },

    /** Export entries as CSV: Term,Note per line */
    toCSV(entries: StudyEntry[]): string {
        const header = 'Term,Note';
        const rows = entries.map((e) => {
            const term = `"${e.term.replace(/"/g, '""')}"`;
            const note = `"${e.note.replace(/"/g, '""')}"`;
            return `${term},${note}`;
        });
        return [header, ...rows].join('\n');
    },

    downloadCSV(entries: StudyEntry[], filename = 'study-group.csv'): void {
        const csv = studyRepo.toCSV(entries);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};