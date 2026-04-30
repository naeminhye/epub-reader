import { useState, useEffect, useCallback } from 'react';
import { db, type Bookmark } from '@/lib/db/schema';

const MAX_BOOKMARKS = 10;

export function useBookmarks(bookId: string | undefined) {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

    useEffect(() => {
        if (!bookId) { setBookmarks([]); return; }
        db.bookmarks
            .where('bookId').equals(bookId)
            .sortBy('createdAt')
            .then(setBookmarks)
            .catch(console.error);
    }, [bookId]);

    const refresh = useCallback(async () => {
        if (!bookId) return;
        const bm = await db.bookmarks.where('bookId').equals(bookId).sortBy('createdAt');
        setBookmarks(bm);
    }, [bookId]);

    const addBookmark = useCallback(async (
        cfi: string,
        label: string,
        chapterTitle?: string
    ): Promise<{ added: boolean; limitReached: boolean }> => {
        if (!bookId) return { added: false, limitReached: false };

        const existing = await db.bookmarks.where('bookId').equals(bookId).count();
        if (existing >= MAX_BOOKMARKS) return { added: false, limitReached: true };

        // Check if this CFI is already bookmarked
        const dup = await db.bookmarks.where({ bookId, cfi }).first();
        if (dup) return { added: false, limitReached: false };

        const bm: Bookmark = {
            id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            bookId,
            cfi,
            label: label.slice(0, 120),
            chapterTitle,
            createdAt: new Date(),
        };
        await db.bookmarks.add(bm);
        await refresh();
        return { added: true, limitReached: false };
    }, [bookId, refresh]);

    const removeBookmark = useCallback(async (id: string) => {
        await db.bookmarks.delete(id);
        await refresh();
    }, [refresh]);

    const isBookmarked = useCallback((cfi: string) =>
        bookmarks.some(bm => bm.cfi === cfi)
        , [bookmarks]);

    return { bookmarks, addBookmark, removeBookmark, isBookmarked, maxBookmarks: MAX_BOOKMARKS };
}