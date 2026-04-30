/**
 * Minimal type augmentation for epubjs v0.3.x
 * The official package ships JS only; this covers what we use.
 * For a full typing solution, install @types/epubjs (community-maintained).
 */

declare module 'epubjs' {
    export interface NavItem {
        id: string;
        href: string;
        label: string;
        subitems?: NavItem[];
    }

    export interface Location {
        start: {
            cfi: string;
            href: string;
            index: number;
            displayed: { page: number; total: number };
            percentage: number;
        };
        end: {
            cfi: string;
            href: string;
            index: number;
            displayed: { page: number; total: number };
            percentage: number;
        };
        atStart?: boolean;
        atEnd?: boolean;
    }

    export interface Contents {
        document: Document;
        window: Window;
        content: HTMLElement;
        documentElement: HTMLElement;
        on(event: string, handler: (...args: unknown[]) => void): void;
        addStylesheet(url: string): Promise<void>;
        addStylesheetCss(css: string): Promise<void>;
    }

    export interface Rendition {
        currentLocation(): Location | null;
        display(target?: string | number): Promise<void>;
        next(): Promise<void>;
        prev(): Promise<void>;
        on(event: 'relocated', handler: (location: Location) => void): void;
        on(event: 'rendered', handler: (section: unknown, view: unknown) => void): void;
        on(event: 'selected', handler: (cfiRange: string, contents: Contents) => void): void;
        on(event: 'click', handler: (e: MouseEvent) => void): void;
        on(event: 'keyup' | 'keydown', handler: (e: KeyboardEvent) => void): void;
        on(event: string, handler: (...args: unknown[]) => void): void;
        off(event: string, handler: (...args: unknown[]) => void): void;
        themes: {
            register(name: string, css: Record<string, unknown>): void;
            register(name: string, url: string): void;
            select(name: string): void;
            fontSize(size: string): void;
            override(name: string, value: string, important?: boolean): void;
        };
        hooks: {
            content: {
                register(handler: (contents: Contents) => void): void;
            };
        };
        getContents(): Contents[];
        annotations: {
            highlight(cfi: string, arg1: {}, arg2: () => void, arg3: string, arg4: { fill: string; 'fill-opacity': string; }): unknown;
            add(
                type: 'highlight' | 'underline' | 'mark',
                cfiRange: string,
                data?: Record<string, unknown>,
                cb?: (e: MouseEvent) => void,
                className?: string,
                styles?: Record<string, string>
            ): void;
            remove(cfiRange: string, type: string): void;
        };
        destroy(): void;
        location: Location | null;
    }

    export interface Book {
        load: any;
        ready: Promise<void>;
        loaded: {
            navigation: Promise<{ toc: NavItem[] }>;
            metadata: Promise<{
                title: string;
                creator: string;
                language: string;
                identifier: string;
            }>;
        };
        locations: {
            generate(chars?: number): Promise<string[]>;
            percentageFromCfi(cfi: string): number;
            cfiFromPercentage(pct: number): string;
            length(): number;
        };
        // Note: book.search() does NOT exist in epubjs v0.3.
        // Use section.find(query) on each spine item instead.
        renderTo(
            element: HTMLElement | string,
            options?: {
                width?: string | number;
                height?: string | number;
                flow?: 'paginated' | 'scrolled' | 'scrolled-doc' | 'scrolled-continuous';
                manager?: 'default' | 'continuous';
                spread?: 'auto' | 'always' | 'none';
                allowScriptedContent?: boolean;
                allowPopups?: boolean;
            }
        ): Rendition;
        destroy(): void;
    }

    export default function ePub(
        input?: string | ArrayBuffer | Blob,
        options?: { openAs?: 'binary' | 'base64' | 'epub' | 'opf' | 'json' | 'directory' }
    ): Book;
}