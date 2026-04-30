/**
 * Metadata extractors for non-EPUB formats.
 * Each returns the same EpubMetadata shape for compatibility with the import pipeline.
 */
import JSZip from 'jszip';
import type { EpubMetadata } from './metadata';

// ── PDF ──────────────────────────────────────────────────────────────────────
// Uses pdf.js (loaded dynamically so it doesn't bloat the initial bundle).
export async function extractPdfMetadata(file: File): Promise<EpubMetadata> {
    // Dynamic import — pdf.js is large (~1MB); only load when needed
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extract metadata from the PDF info dictionary
    const info = await pdf.getMetadata().catch(() => ({ info: {}, metadata: null }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfInfo = (info.info ?? {}) as Record<string, any>;

    const title = String(pdfInfo.Title ?? '').trim() || stripExtension(file.name);
    const author = String(pdfInfo.Author ?? '').trim() || 'Unknown';

    // Generate cover from the first page rendered as a canvas → Blob
    let coverBlob: Blob | undefined;
    try {
        const page = await pdf.getPage(1);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        coverBlob = await new Promise<Blob | undefined>(resolve =>
            canvas.toBlob(b => resolve(b ?? undefined), 'image/jpeg', 0.85)
        );
    } catch { /* cover optional */ }

    return { title, author, coverBlob };
}

// ── CBZ (Comic Book ZIP) ─────────────────────────────────────────────────────
// A CBZ is just a zip of images, optionally with a ComicInfo.xml.
export async function extractCbzMetadata(file: File): Promise<EpubMetadata> {
    const zip = await JSZip.loadAsync(file);

    // Try ComicInfo.xml first (standard metadata file for comics)
    let title = stripExtension(file.name);
    let author = 'Unknown';

    const comicInfo = zip.file('ComicInfo.xml') ?? zip.file(/ComicInfo\.xml$/i)[0];
    if (comicInfo) {
        const xml = await comicInfo.async('text');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        title = doc.querySelector('Title')?.textContent?.trim() || title;
        author = doc.querySelector('Writer')?.textContent?.trim() || author;
    }

    // Use the first image in the archive as the cover
    const imageFiles = Object.keys(zip.files)
        .filter(name => /\.(jpe?g|png|webp|gif|avif)$/i.test(name))
        .sort();

    let coverBlob: Blob | undefined;
    if (imageFiles.length > 0) {
        const imageFile = zip.file(imageFiles[0])!;
        const ext = imageFiles[0].split('.').pop()?.toLowerCase() ?? 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        coverBlob = new Blob([await imageFile.async('arraybuffer')], { type: mime });
    }

    return { title, author, coverBlob };
}

// ── Plain text / Markdown ────────────────────────────────────────────────────
export async function extractTxtMetadata(file: File): Promise<EpubMetadata> {
    const title = stripExtension(file.name);
    // Try to read the first line as the title (common in Project Gutenberg books)
    try {
        const slice = await file.slice(0, 512).text();
        const firstLine = slice.split('\n').map(l => l.trim()).find(l => l.length > 0);
        if (firstLine && firstLine.length < 120) {
            return { title: firstLine, author: 'Unknown' };
        }
    } catch { /* ignore */ }
    return { title, author: 'Unknown' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
}