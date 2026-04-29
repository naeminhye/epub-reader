import { useCallback, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useLibraryStore } from '@/stores/libraryStore';
import { useT } from '@/lib/i18n/context';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { CloudUploadIcon, BookOpenIcon } from '@hugeicons/core-free-icons';

export function ImportDropZone() {
    const { importEpub, isImporting } = useLibraryStore();
    const t = useT();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        for (const file of Array.from(files)) {
            const result = await importEpub(file);
            if (result) {
                toast.success(t.importAdded(result.title));
            } else {
                const err = useLibraryStore.getState().importError;
                toast.error(err || t.importFailed(file.name));
            }
        }
    }, [importEpub, t]);

    return (
        <Card
            className={`relative flex flex-col items-center justify-center aspect-[2/3] cursor-pointer transition-all duration-200 border-2 border-dashed ${isDragging ? 'border-foreground bg-muted/50 scale-[1.02]' : 'border-border hover:border-foreground/50 hover:bg-muted/20'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
        >
            <input ref={fileInputRef} type="file" accept=".epub,application/epub+zip" multiple className="hidden"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
            <div className="flex flex-col items-center gap-3 px-4 text-center">
                <HugeiconsIcon icon={isImporting ? BookOpenIcon : CloudUploadIcon} size={32} className="text-muted-foreground" />
                <div className="space-y-1">
                    <p className="font-heading text-sm font-medium">{isImporting ? t.importing : t.addEpub}</p>
                    <p className="text-xs text-muted-foreground">{isImporting ? t.readingFile : t.dropOrClick}</p>
                </div>
            </div>
        </Card>
    );
}