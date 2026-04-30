import { useEffect, useState, useMemo, useRef } from 'react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useReaderStore } from '@/stores/readerStore';
import { useLocale, useT } from '@/lib/i18n/context';
import { bookStatus, type Book } from '@/lib/db/schema';
import { BookCard } from './BookCard';
import { toast } from 'sonner';
import '@/styles/library.css';
import { QuoteUpIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

type Filter = 'all' | 'reading' | 'new' | 'done';
type Layout = 'grid' | 'list';

export function LibraryView() {
    const { books, isLoading, loadLibrary, removeBook } = useLibraryStore();
    const { openBook, prefs, updatePrefs } = useReaderStore();
    const isReaderOpen = useReaderStore(s => s.isReaderOpen);
    const { locale, setLocale } = useLocale();
    const t = useT();

    const [filter, setFilter] = useState<Filter>('all');
    const [layout, setLayout] = useState<Layout>('grid');
    const [query, setQuery] = useState('');
    const [langOpen, setLangOpen] = useState(false);

    // Load on mount
    useEffect(() => { loadLibrary(); }, [loadLibrary]);

    // Reload when the reader closes so continueBook/progress reflects latest reads
    const prevReaderOpen = useRef(false);
    useEffect(() => {
        if (prevReaderOpen.current && !isReaderOpen) {
            loadLibrary();
        }
        prevReaderOpen.current = isReaderOpen;
    }, [isReaderOpen, loadLibrary]);

    const continueBook = useMemo(() =>
        books.find(b => b.progress > 0 && b.progress < 0.95 && b.lastReadAt)
        , [JSON.stringify(books)]); // Deep compare to catch progress/lastReadAt changes

    console.log('Continue book:', continueBook);
    const filtered = useMemo(() => {
        let list = books;
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
        }
        if (filter !== 'all') list = list.filter(b => bookStatus(b) === filter);
        return list;
    }, [books, filter, query]);

    const counts = useMemo(() => ({
        reading: books.filter(b => bookStatus(b) === 'reading').length,
        new: books.filter(b => bookStatus(b) === 'new').length,
        done: books.filter(b => bookStatus(b) === 'done').length,
    }), [books]);

    const showContinue = !!continueBook && !query;

    const cycleTheme = () => {
        const next = prefs.theme === 'light' ? 'sepia' : prefs.theme === 'sepia' ? 'dark' : 'light';
        updatePrefs({ theme: next });
    };

    const themeIcon = prefs.theme === 'dark'
        ? '☽'
        : prefs.theme === 'sepia'
            ? '◑'
            : '☀';

    return (
        <div style={{ background: 'var(--paper)', minHeight: '100vh', color: 'var(--ink)' }}>
            <div style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 56px 120px' }}>

                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
                        {/* Left: eyebrow + title */}
                        <div>
                            <p className="eyebrow" style={{ marginBottom: 6 }}>
                                {isLoading ? t.libraryLoading : t.libraryBookCount(books.length).toUpperCase()}
                            </p>
                            <h1 style={{
                                fontFamily: 'var(--serif)', fontSize: 52, lineHeight: 1.05,
                                margin: 0, fontWeight: 500, letterSpacing: '-.01em',
                                fontStyle: 'italic', whiteSpace: 'nowrap', color: 'var(--ink)',
                            }}>
                                Aurobie
                            </h1>
                        </div>

                        {/* Right: search + global controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            {/* Search pill */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--paper-2)', border: '.5px solid var(--line-2)',
                                borderRadius: 999, padding: '9px 14px', minWidth: 280,
                                color: 'var(--ink-3)',
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                </svg>
                                <input
                                    type="text" value={query} onChange={e => setQuery(e.target.value)}
                                    placeholder={t.searchTitleOrAuthor}
                                    style={{ border: 0, background: 'transparent', outline: 'none', flex: 1, font: '13px/1 var(--sans)', color: 'var(--ink)' }}
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} style={{ border: 0, background: 'var(--paper-3)', width: 18, height: 18, borderRadius: 999, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 12 }}>×</button>
                                )}
                            </div>

                            {/* Theme toggle */}
                            <button
                                onClick={cycleTheme}
                                title={t.themeLabel(prefs.theme)}
                                style={{ border: '.5px solid var(--line-2)', background: 'var(--paper-2)', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}
                            >
                                {themeIcon}
                            </button>

                            {/* Language dropdown */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                    onClick={() => setLangOpen(o => !o)}
                                    title={t.language}
                                    style={{ border: '.5px solid var(--line-2)', background: 'var(--paper-2)', height: 36, padding: '0 12px', borderRadius: 8, cursor: 'pointer', font: '600 11px/1 var(--sans)', letterSpacing: '.08em', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                                    {locale.toUpperCase()}
                                </button>
                                {langOpen && (
                                    <>
                                        <div onClick={() => setLangOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'var(--paper)', border: '.5px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 36px -12px rgba(0,0,0,.2)', zIndex: 100, minWidth: 140 }}>
                                            {([['en', 'English'], ['vi', 'Tiếng Việt'], ['ko', '한국어']] as const).map(([code, label]) => (
                                                <button key={code} onClick={() => { setLocale(code); setLangOpen(false); }}
                                                    style={{ width: '100%', padding: '10px 14px', border: 0, background: locale === code ? 'var(--paper-2)' : 'transparent', textAlign: 'left', font: '500 13px/1 var(--sans)', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    {label}
                                                    {locale === code && <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Continue card */}
                    {showContinue && continueBook && (
                        <ContinueCard book={continueBook} onOpen={openBook} />
                    )}

                    {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 18, borderBottom: '.5px solid var(--line)' }}>
                        {/* Filter chips */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            {(['all', 'reading', 'new', 'done'] as Filter[]).map(f => {
                                const count = f === 'all' ? books.length : counts[f];
                                const isOn = filter === f;
                                return (
                                    <button key={f} onClick={() => setFilter(f)} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '8px 14px', borderRadius: 999, border: 0,
                                        background: isOn ? 'var(--ink)' : 'transparent',
                                        color: isOn ? 'var(--paper)' : 'var(--ink-3)',
                                        font: '500 13px/1 var(--sans)', cursor: 'pointer',
                                    }}>
                                        {f === 'all' ? t.library : f === 'reading' ? t.badgeReading : f === 'new' ? t.badgeNew : t.badgeDone}
                                        <span style={{ display: 'inline-grid', placeItems: 'center', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: isOn ? 'var(--accent)' : 'var(--paper-3)', color: isOn ? '#1a1814' : 'var(--ink-3)', fontSize: 10, fontWeight: 600 }}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right: layout + import */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', padding: 2, background: 'var(--paper-2)', border: '.5px solid var(--line)', borderRadius: 8 }}>
                                {(['grid', 'list'] as Layout[]).map(l => (
                                    <button key={l} onClick={() => setLayout(l)} title={l}
                                        style={{ border: 0, background: layout === l ? 'var(--paper)' : 'transparent', color: layout === l ? 'var(--ink)' : 'var(--ink-3)', width: 30, height: 28, borderRadius: 6, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: layout === l ? '0 1px 3px rgba(0,0,0,.06)' : 'none' }}>
                                        {l === 'grid' ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                                                <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                                            </svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <ImportTrigger />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ paddingTop: 32 }}>
                    {layout === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '36px 24px' }}>
                            {filtered.map(book => (
                                <BookCard key={book.id} book={book} onOpen={openBook} onDelete={removeBook} />
                            ))}
                        </div>
                    ) : (
                        <ListLayout books={filtered} onOpen={openBook} onDelete={removeBook} />
                    )}
                    {filtered.length === 0 && !isLoading && (
                        <div style={{ textAlign: 'center', padding: '64px 0' }}>
                            <p style={{ fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--ink-3)' }}>
                                {query ? `No books matching "${query}"` : t.libraryEmpty}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Continue card ────────────────────────────────────────────────
function ContinueCard({ book, onOpen }: { book: Book; onOpen: (b: Book) => void }) {
    const t = useT();
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    type RecentHighlight = { text: string; cfi?: string };
    const [recentHighlight, setRecentHighlight] = useState<RecentHighlight | null>(null);

    useEffect(() => {
        if (!book.coverBlob) return;
        const url = URL.createObjectURL(book.coverBlob);
        setCoverUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [book.coverBlob]);

    // Load most recent highlight for this book
    useEffect(() => {
        import('@/lib/db/schema').then(({ db }) => {
            db.highlights
                .where('bookId').equals(book.id)
                .sortBy('createdAt')
                .then(highlights => {
                    const last = highlights[highlights.length - 1];
                    if (last) setRecentHighlight(last as unknown as RecentHighlight);
                })
                .catch(() => { });
        });
    }, [book.id]);

    const pct = Math.round(book.progress * 100);
    const lastRead = book.lastReadAt
        ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round((Date.now() - book.lastReadAt.getTime()) / 86400000), 'day')
        : '';

    return (
        <div onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 18px 40px -20px rgba(0,0,0,.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            className='continue-card'
            style={{ gridTemplateColumns: recentHighlight ? '156px 1fr 280px' : '156px 1fr' }}
        >
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(800px 200px at 100% 0%, var(--accent-glow), transparent 60%)', opacity: .35 }} />
            <div style={{ width: 156, height: 232, flexShrink: 0, cursor: 'pointer' }} onClick={() => onOpen(book)}>
                {coverUrl
                    ? <img src={coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, boxShadow: '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 14px 32px -8px rgba(0,0,0,.35)' }} />
                    : <PlaceholderCover title={book.title} width={156} height={232} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 0 4px var(--accent-glow)', display: 'inline-block' }} className="animate-pulse-led" />
                    {t.continueReading}{lastRead ? ` · ${lastRead}` : ''}
                </div>
                <h2 onClick={() => onOpen(book)} style={{ fontFamily: 'var(--serif)', fontSize: 38, lineHeight: 1.05, margin: 0, fontStyle: 'italic', fontWeight: 500, letterSpacing: '-.01em', color: 'var(--ink)', cursor: 'pointer' }}>
                    {book.title}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500 }}>{book.author}</p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--paper-3)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink)' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                </div>

                <button onClick={() => onOpen(book)} style={{ marginTop: 4, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999, border: 0, background: 'var(--ink)', color: 'var(--paper)', font: '500 13px/1 var(--sans)', cursor: 'pointer', letterSpacing: '.02em' }}>
                    {t.resume} →
                </button>
            </div>

            {/* Recent highlight quote */}
            {recentHighlight && (
                <div className="continue-quote">
                    <HugeiconsIcon icon={QuoteUpIcon} />
                    <p>"{recentHighlight.text.length > 120 ? recentHighlight.text.slice(0, 120) + '…' : recentHighlight.text}"</p>
                </div>
            )}
        </div>
    );
}

// ── List layout ──────────────────────────────────────────────────
function ListLayout({ books, onOpen, onDelete }: { books: Book[]; onOpen: (b: Book) => void; onDelete: (id: string) => void }) {
    const t = useT();
    return (
        <div style={{ border: '.5px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--paper-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.2fr 1fr', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--paper)', borderBottom: '.5px solid var(--line)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>
                <span>{t.bookTitle}</span><span>{t.author}</span><span>{t.progress}</span><span>{t.lastRead}</span>
            </div>
            {books.map((book, i) => <ListRow key={book.id} book={book} onOpen={onOpen} onDelete={onDelete} last={i === books.length - 1} />)}
        </div>
    );
}

function ListRow({ book, onOpen, onDelete, last }: { book: Book; onOpen: (b: Book) => void; onDelete: (id: string) => void; last: boolean }) {
    const t = useT();
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);
    useEffect(() => {
        if (!book.coverBlob) return;
        const url = URL.createObjectURL(book.coverBlob);
        setCoverUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [book.coverBlob]);
    const pct = Math.round(book.progress * 100);
    const lastRead = book.lastReadAt ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(book.lastReadAt) : '—';
    return (
        <button onClick={() => onOpen(book)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onContextMenu={e => { e.preventDefault(); if (confirm(t.removeConfirm(book.title))) onDelete(book.id); }}
            style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1.2fr 1fr', alignItems: 'center', gap: 16, padding: '14px 18px', border: 0, background: hovered ? 'var(--paper)' : 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: last ? 0 : '.5px solid var(--line)', width: '100%', color: 'var(--ink)', transition: 'background .15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 60, flexShrink: 0, borderRadius: 2, overflow: 'hidden', background: 'var(--paper-3)' }}>
                    {coverUrl && <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.2, fontStyle: 'italic', fontWeight: 500, margin: 0 }}>{book.title}</p>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{book.author}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 3, background: 'var(--paper-3)', borderRadius: 999, overflow: 'hidden', maxWidth: 120 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink)' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{lastRead}</span>
        </button>
    );
}

// ── Import trigger ────────────────────────────────────────────────
function ImportTrigger() {
    const t = useT();
    const { importEpub, isImporting } = useLibraryStore();
    const ref = useRef<HTMLInputElement>(null);
    const handle = async (files: FileList | null) => {
        if (!files) return;
        for (const file of Array.from(files)) {
            const result = await importEpub(file);
            if (result) toast.success(t.importAdded(result.title));
            else toast.error(t.importFailed(file.name));
        }
    };
    return (
        <>
            <input ref={ref} type="file" accept=".epub,application/epub+zip" multiple className="hidden" onChange={e => { handle(e.target.files); e.target.value = ''; }} />
            <button onClick={() => ref.current?.click()} disabled={isImporting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'var(--accent)', color: '#1a1814', border: 0, font: '600 12px/1 var(--sans)', cursor: 'pointer', letterSpacing: '.02em', boxShadow: '0 1px 0 rgba(255,255,255,.4) inset, 0 4px 14px -4px var(--accent-glow)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                {isImporting ? t.importing : t.addEpub}
            </button>
        </>
    );
}

// ── Placeholder cover ─────────────────────────────────────────────
function PlaceholderCover({ title, width, height }: { title: string; width: number; height: number }) {
    const hue = [...title].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return (
        <div style={{ width, height, borderRadius: 4, overflow: 'hidden', background: `hsl(${hue} 25% 72%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 0 rgba(255,255,255,.06) inset, -2px 0 0 rgba(0,0,0,.18) inset, 0 14px 32px -8px rgba(0,0,0,.35)' }}>
            <div style={{ fontSize: 36, fontFamily: 'var(--serif)', fontStyle: 'italic', color: `hsl(${hue} 25% 30%)`, fontWeight: 500 }}>{initials}</div>
        </div>
    );
}