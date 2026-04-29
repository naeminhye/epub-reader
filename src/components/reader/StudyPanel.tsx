import { useEffect, useState, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReaderStore } from '@/stores/readerStore';
import { useT } from '@/lib/i18n/context';
import { studyRepo } from '@/lib/db/studyRepo';
import type { StudyEntry } from '@/lib/db/schema';
import { toast } from 'sonner';

interface StudyPanelProps {
    open: boolean;
    onClose: () => void;
    /** Pre-filled term from current selection */
    initialTerm?: string;
}

export function StudyPanel({ open, onClose, initialTerm }: StudyPanelProps) {
    const t = useT();
    const { currentBook } = useReaderStore();

    const [entries, setEntries] = useState<StudyEntry[]>([]);
    const [term, setTerm] = useState('');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState('');

    // Load entries when panel opens
    useEffect(() => {
        if (!open || !currentBook) return;
        studyRepo.listForBook(currentBook.id).then(setEntries);
    }, [open, currentBook]);

    // Pre-fill term from selection
    useEffect(() => {
        if (open && initialTerm) {
            setTerm(initialTerm);
            setNote('');
        }
    }, [open, initialTerm]);

    const handleAdd = async () => {
        if (!term.trim() || !currentBook) return;
        setIsSaving(true);
        try {
            const entry: StudyEntry = {
                id: crypto.randomUUID(),
                bookId: currentBook.id,
                bookTitle: currentBook.title,
                term: term.trim(),
                note: note.trim(),
                createdAt: new Date(),
            };
            await studyRepo.add(entry);
            setEntries((prev) => [entry, ...prev]);
            setTerm('');
            setNote('');
            toast.success(t.studyAdded);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t.studyDeleteConfirm)) return;
        await studyRepo.delete(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    const handleSaveNote = async (id: string) => {
        await studyRepo.updateNote(id, editNote);
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: editNote } : e));
        setEditingId(null);
    };

    const handleExport = useCallback(async () => {
        if (!currentBook) return;
        const all = await studyRepo.listForBook(currentBook.id);
        if (all.length === 0) return;
        const filename = `${currentBook.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-study.csv`;
        studyRepo.downloadCSV(all, filename);
    }, [currentBook]);

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 h-full">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="font-heading">{t.studyGroup}</SheetTitle>
                        {entries.length > 0 && (
                            <Button variant="outline" size="sm" onClick={handleExport} className="text-xs h-7">
                                {t.studyExport}
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                {/* Add form */}
                <div className="px-6 py-4 border-b shrink-0 space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t.studyTerm}</Label>
                        <Input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder={t.studyTermPlaceholder}
                            className="text-sm"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">{t.studyNote}</Label>
                        <Textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t.studyNotePlaceholder}
                            className="text-sm resize-none"
                            rows={2}
                        />
                    </div>
                    <Button
                        size="sm"
                        onClick={handleAdd}
                        disabled={!term.trim() || isSaving}
                        className="w-full"
                    >
                        {t.studyAdd}
                    </Button>
                </div>

                {/* Entries list */}
                <ScrollArea className="flex-1 min-h-0">
                    {entries.length === 0 ? (
                        <p className="px-6 py-8 text-sm text-muted-foreground text-center">
                            {t.studyEmpty}
                        </p>
                    ) : (
                        <div className="divide-y">
                            {entries.map((entry) => (
                                <div key={entry.id} className="px-6 py-4 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium leading-snug">{entry.term}</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDelete(entry.id)}
                                        >
                                            ×
                                        </Button>
                                    </div>

                                    {editingId === entry.id ? (
                                        <div className="space-y-1.5">
                                            <Textarea
                                                value={editNote}
                                                onChange={(e) => setEditNote(e.target.value)}
                                                className="text-xs resize-none"
                                                rows={2}
                                                autoFocus
                                            />
                                            <div className="flex gap-1.5">
                                                <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveNote(entry.id)}>
                                                    Save
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p
                                            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors line-clamp-2"
                                            onClick={() => { setEditingId(entry.id); setEditNote(entry.note); }}
                                        >
                                            {entry.note || <span className="italic opacity-50">{t.studyNotePlaceholder}</span>}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {entries.length > 0 && (
                    <div className="border-t px-6 py-2 shrink-0">
                        <p className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}