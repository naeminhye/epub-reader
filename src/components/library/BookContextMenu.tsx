import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';

interface ContextMenuPos { x: number; y: number }

interface BookContextMenuProps {
    title: string;
    onDelete: () => void;
    children: (handlers: {
        onContextMenu: (e: React.MouseEvent) => void;
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchEnd: () => void;
        onTouchMove: () => void;
    }) => React.ReactNode;
}

export function BookContextMenu({ title, onDelete, children }: BookContextMenuProps) {
    const t = useT();
    const [menuPos, setMenuPos] = useState<ContextMenuPos | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const openMenu = (x: number, y: number) => {
        // Clamp so menu doesn't overflow viewport
        const menuW = 180;
        const menuH = 48;
        const cx = Math.min(x, window.innerWidth - menuW - 8);
        const cy = Math.min(y, window.innerHeight - menuH - 8);
        setMenuPos({ x: cx, y: cy });
    };

    const closeMenu = () => setMenuPos(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        openMenu(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        longPressTimer.current = setTimeout(() => {
            openMenu(touch.clientX, touch.clientY);
        }, 500);
    };

    const cancelLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // Close menu on outside click
    useEffect(() => {
        if (!menuPos) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeMenu();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuPos]);

    const handleRemoveClick = () => {
        closeMenu();
        setConfirmOpen(true);
    };

    const handleConfirm = () => {
        setConfirmOpen(false);
        onDelete();
    };

    return (
        <>
            {children({
                onContextMenu: handleContextMenu,
                onTouchStart: handleTouchStart,
                onTouchEnd: cancelLongPress,
                onTouchMove: cancelLongPress,
            })}

            {/* Context menu */}
            {menuPos && (
                <div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: menuPos.y,
                        left: menuPos.x,
                        zIndex: 1000,
                        background: 'var(--paper)',
                        border: '.5px solid var(--line-2)',
                        borderRadius: 10,
                        boxShadow: '0 8px 32px -8px rgba(0,0,0,.22), 0 2px 8px -2px rgba(0,0,0,.12)',
                        overflow: 'hidden',
                        minWidth: 180,
                    }}
                >
                    <button
                        onClick={handleRemoveClick}
                        style={{
                            width: '100%', padding: '11px 14px', border: 0,
                            background: 'transparent', textAlign: 'left',
                            font: '500 13px/1 var(--sans)', cursor: 'pointer',
                            color: '#e05252', display: 'flex', alignItems: 'center', gap: 10,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                        {t.removeFromLibrary}
                    </button>
                </div>
            )}

            {/* Confirm dialog */}
            {confirmOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1001,
                        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20,
                    }}
                    onClick={() => setConfirmOpen(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--paper)',
                            border: '.5px solid var(--line-2)',
                            borderRadius: 16,
                            padding: '28px 28px 24px',
                            maxWidth: 380, width: '100%',
                            boxShadow: '0 24px 64px -16px rgba(0,0,0,.3)',
                        }}
                    >
                        {/* Trash icon */}
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'rgba(224,82,82,.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 16,
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                        </div>

                        <p style={{
                            fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.3,
                            fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)',
                            margin: '0 0 8px',
                        }}>
                            {t.removeConfirm(title)}
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 24px', lineHeight: 1.5 }}>
                            {t.removeConfirmDesc}
                        </p>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConfirmOpen(false)}
                                style={{
                                    padding: '9px 18px', borderRadius: 8,
                                    border: '.5px solid var(--line-2)',
                                    background: 'var(--paper-2)', color: 'var(--ink)',
                                    font: '500 13px/1 var(--sans)', cursor: 'pointer',
                                }}
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={handleConfirm}
                                style={{
                                    padding: '9px 18px', borderRadius: 8, border: 0,
                                    background: '#e05252', color: '#fff',
                                    font: '600 13px/1 var(--sans)', cursor: 'pointer',
                                }}
                            >
                                {t.remove}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
