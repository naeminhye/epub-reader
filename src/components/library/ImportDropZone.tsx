import { useCallback, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLibraryStore } from '@/stores/libraryStore';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { CloudUploadIcon, BookOpenIcon } from '@hugeicons/core-free-icons';

export function ImportDropZone() {
    const { importEpub, isImporting } = useLibraryStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const arr = Array.from(files);
            for (const file of arr) {
                const result = await importEpub(file);
                if (result) {
                    toast.success(`Added "${result.title}"`);
                } else {
                    const err = useLibraryStore.getState().importError;
                    toast.error(err || `Failed to import ${file.name}`);
                }
            }
        },
        [importEpub]
    );

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleClick = () => fileInputRef.current?.click();

    return (
        <Card
            className={`
        relative flex flex-col items-center justify-center
        aspect-[2/3] cursor-pointer transition-all duration-200
        border-2 border-dashed
        ${isDragging ? 'border-foreground bg-muted/50 scale-[1.02]' : 'border-border hover:border-foreground/50 hover:bg-muted/20'}
      `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".epub,application/epub+zip"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = ''; // allow re-importing the same file
                }}
            />
            <div className="flex flex-col items-center gap-3 px-4 text-center">
                <HugeiconsIcon
                    icon={isImporting ? BookOpenIcon : CloudUploadIcon}
                    size={32}
                    className="text-muted-foreground"
                />
                <div className="space-y-1">
                    <p className="font-heading text-sm font-medium">
                        {isImporting ? 'Importing…' : 'Add EPUB'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {isImporting ? 'Reading file' : 'Drop or click to browse'}
                    </p>
                </div>
            </div>
        </Card>
    );
}