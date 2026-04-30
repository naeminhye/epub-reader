import { useEffect, useState } from 'react';
import type { Book } from '@/lib/db/schema';
import { bookStatus } from '@/lib/db/schema';
import { useT } from '@/lib/i18n/context';

interface BookCardProps {
    book: Book;
    onOpen: (book: Book) => void;
    onDelete: (id: string) => void;
}

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
    const t = useT();
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);
    const status = bookStatus(book);

    const pct = Math.round(book.progress * 100);

    useEffect(() => {
        if (!book.coverBlob) return;
        const url = URL.createObjectURL(book.coverBlob);
        setCoverUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [book.coverBlob]);

    const hue = [...book.title].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    const initials = book.title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    return (
        <button
            type="button"
            onClick={() => onOpen(book)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onContextMenu={e => {
                e.preventDefault();
                if (confirm(t.removeConfirm(book.title))) onDelete(book.id);
            }}
            style={{
                border: 0, background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 12,
                padding: 0, textAlign: 'left',
                transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
                transition: 'transform .25s cubic-bezier(.2,.8,.2,1)',
                position: 'relative',
            }}
        >
            {/* Cover */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3' }}>
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={book.title}
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            borderRadius: 4,
                            boxShadow: hovered
                                ? '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 22px 50px -10px rgba(0,0,0,.4), 0 6px 18px -6px rgba(0,0,0,.3)'
                                : '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 14px 32px -8px rgba(0,0,0,.35), 0 4px 12px -4px rgba(0,0,0,.25)',
                            transition: 'box-shadow .25s',
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%', borderRadius: 4,
                        background: `hsl(${hue} 25% 72%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: hovered
                            ? '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 22px 50px -10px rgba(0,0,0,.4)'
                            : '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 14px 32px -8px rgba(0,0,0,.35)',
                        transition: 'box-shadow .25s',
                    }}>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', fontWeight: 500, color: `hsl(${hue} 25% 30%)` }}>
                            {initials}
                        </span>
                    </div>
                )}

                {/* Status badge */}
                {status === 'new' && (
                    <span style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'var(--accent)', color: '#1a1814',
                        font: '600 9px/1 var(--sans)', letterSpacing: '.12em',
                        textTransform: 'uppercase', padding: '4px 6px', borderRadius: 4,
                    }}>
                        {t.badgeNew}
                    </span>
                )}

                {/* Status badge */}
                {status === 'done' && (
                    <span style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'var(--accent)', color: '#1a1814',
                        font: '600 9px/1 var(--sans)', letterSpacing: '.12em',
                        textTransform: 'uppercase', padding: '4px 6px', borderRadius: 4,
                    }}>
                        {t.badgeDone}
                    </span>
                )}

                {/* Reading progress stripe */}
                {status === 'reading' && (
                    <div style={{
                        position: 'absolute', bottom: 8, left: 6, right: 6,
                        height: 2, background: 'rgba(255,255,255,.2)', borderRadius: 999,
                    }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 999 }} />
                    </div>
                )}
            </div>

            {/* Meta */}
            <div style={{ padding: '0 2px' }}>
                <p style={{
                    fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.2,
                    fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)',
                    margin: '0 0 3px',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                    {book.title}
                </p>
                <p style={{
                    fontSize: 10, color: 'var(--ink-3)',
                    letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {book.author}
                </p>
            </div>
        </button>
    );
}