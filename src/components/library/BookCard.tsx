import { useEffect, useState } from 'react';
import type { Book } from '@/lib/db/schema';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { BookOpenIcon, Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

interface BookCardProps {
    book: Book;
    onOpen: (book: Book) => void;
    onDelete: (id: string) => void;
}

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
    const [coverUrl, setCoverUrl] = useState<string | null>(null);

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
                    Open
                </ContextMenuItem>
                <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                        if (confirm(`Remove "${book.title}" from library?`)) {
                            onDelete(book.id);
                        }
                    }}
                >
                    <HugeiconsIcon icon={Delete02Icon} size={16} className="mr-2" />
                    Remove from library
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}