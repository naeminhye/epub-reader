import { useEffect, useState } from 'react';
import type { Book } from '@/lib/db/schema';
import { bookStatus } from '@/lib/db/schema';
import { Card } from '@/components/ui/card';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { BookOpenIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useT } from '@/lib/i18n/context';

interface BookCardProps {
    book: Book;
    onOpen: (book: Book) => void;
    onDelete: (id: string) => void;
}

const STATUS_STYLES = {
    new: 'bg-primary text-primary-foreground',
    reading: 'bg-amber-500 text-white',
    done: 'bg-green-600 text-white',
} as const;

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
    const t = useT();
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const status = bookStatus(book);

    const badgeLabel = {
        new: t.badgeNew,
        reading: t.badgeReading,
        done: t.badgeDone,
    }[status];

    useEffect(() => {
        if (!book.coverBlob) return;
        const url = URL.createObjectURL(book.coverBlob);
        setCoverUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [book.coverBlob]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Card
                    className="group flex flex-col overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
                    onClick={() => onOpen(book)}
                >
                    <div className="aspect-[2/3] bg-muted relative overflow-hidden">
                        {coverUrl ? (
                            <img
                                src={coverUrl}
                                alt={book.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <HugeiconsIcon icon={BookOpenIcon} size={40} className="text-muted-foreground/40" />
                            </div>
                        )}

                        {/* Status badge — top-left corner */}
                        <span className={`absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm tracking-wide leading-tight ${STATUS_STYLES[status]}`}>
                            {badgeLabel}
                        </span>

                        {/* Reading progress bar */}
                        {book.progress > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
                                <div
                                    className="h-full bg-foreground/60"
                                    style={{ width: `${Math.round(book.progress * 100)}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-3 space-y-1">
                        <h3 className="font-heading text-sm font-medium line-clamp-2 leading-tight">
                            {book.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                    </div>
                </Card>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={() => onOpen(book)}>
                    <HugeiconsIcon icon={BookOpenIcon} size={16} className="mr-2" />
                    {t.open}
                </ContextMenuItem>
                <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                        if (confirm(t.removeConfirm(book.title))) {
                            onDelete(book.id);
                        }
                    }}
                >
                    <HugeiconsIcon icon={Delete02Icon} size={16} className="mr-2" />
                    {t.removeFromLibrary}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}