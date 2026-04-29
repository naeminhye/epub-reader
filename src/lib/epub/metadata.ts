import JSZip from 'jszip';

export interface EpubMetadata {
    title: string;
    author: string;
    language?: string;
    coverBlob?: Blob;
}

/**
 * Extract minimal metadata from an EPUB file blob without loading the full reader.
 * Used for the import flow to populate library cards.
 */
export async function extractEpubMetadata(file: File | Blob): Promise<EpubMetadata> {
    const zip = await JSZip.loadAsync(file);

    // Step 1: read META-INF/container.xml to find the OPF path
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
        throw new Error('Invalid EPUB: missing META-INF/container.xml');
    }
    const containerXml = await containerFile.async('text');
    const opfPath = parseContainerXml(containerXml);
    if (!opfPath) {
        throw new Error('Invalid EPUB: cannot find OPF path in container.xml');
    }

    // Step 2: read the OPF (package document)
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
        throw new Error(`Invalid EPUB: missing OPF at ${opfPath}`);
    }
    const opfXml = await opfFile.async('text');
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));

    // Step 3: parse metadata + manifest
    const { title, author, language, coverHref } = parseOpfXml(opfXml);

    // Step 4: extract cover image if found
    let coverBlob: Blob | undefined;
    if (coverHref) {
        const coverPath = opfDir ? `${opfDir}/${coverHref}` : coverHref;
        const coverFile = zip.file(coverPath);
        if (coverFile) {
            const ext = coverHref.split('.').pop()?.toLowerCase() ?? 'jpg';
            const mime =
                ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
            coverBlob = await coverFile.async('blob').then((b) => new Blob([b], { type: mime }));
        }
    }

    return {
        title: title || 'Untitled',
        author: author || 'Unknown',
        language,
        coverBlob,
    };
}

function parseContainerXml(xml: string): string | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const rootfile = doc.querySelector('rootfile');
    return rootfile?.getAttribute('full-path') ?? null;
}

interface OpfData {
    title: string;
    author: string;
    language?: string;
    coverHref?: string;
}

function parseOpfXml(xml: string): OpfData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    // Title — pick the first dc:title
    const titleEl = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0]
        ?? doc.querySelector('title');
    const title = titleEl?.textContent?.trim() ?? '';

    // Author — first dc:creator
    const authorEl = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]
        ?? doc.querySelector('creator');
    const author = authorEl?.textContent?.trim() ?? '';

    // Language — first dc:language
    const langEl = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'language')[0]
        ?? doc.querySelector('language');
    const language = langEl?.textContent?.trim();

    // Cover — try EPUB 3 properties="cover-image" first, then EPUB 2 meta name="cover"
    let coverHref: string | undefined;

    // EPUB 3: <item properties="cover-image" href="..."/>
    const items = Array.from(doc.querySelectorAll('manifest item'));
    const epub3Cover = items.find((it) => it.getAttribute('properties')?.includes('cover-image'));
    if (epub3Cover) {
        coverHref = epub3Cover.getAttribute('href') ?? undefined;
    }

    // EPUB 2: <meta name="cover" content="cover-id"/>
    if (!coverHref) {
        const coverMeta = Array.from(doc.querySelectorAll('metadata meta')).find(
            (m) => m.getAttribute('name') === 'cover'
        );
        const coverId = coverMeta?.getAttribute('content');
        if (coverId) {
            const coverItem = items.find((it) => it.getAttribute('id') === coverId);
            coverHref = coverItem?.getAttribute('href') ?? undefined;
        }
    }

    return { title, author, language, coverHref };
}