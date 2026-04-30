import { useCallback, useEffect, useRef } from 'react';
import { useTxtReader } from '@/lib/readers/useTxtReader';
import { useReaderStore } from '@/stores/readerStore';
import { useT } from '@/lib/i18n/context';

interface TxtReaderViewProps {
    fileBlob: Blob;
    onProgressChange: (progress: number) => void;
}

export function TxtReaderView({ fileBlob, onProgressChange }: TxtReaderViewProps) {
    const t = useT();
    const { prefs } = useReaderStore();
    const scrollRef = useRef<HTMLDivElement>(null);
    const onProgressRef = useRef(onProgressChange);
    onProgressRef.current = onProgressChange;

    const { isReady, error, content } = useTxtReader({ blob: fileBlob });

    // Track scroll progress
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollable = el.scrollHeight - el.clientHeight;
        const progress = scrollable > 0 ? el.scrollTop / scrollable : 0;
        onProgressRef.current(progress);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [isReady, handleScroll]);

    const isMarkdown = (fileBlob as File).name?.toLowerCase().endsWith('.md');

    const fontFamily = prefs.readerFont === 'eb-garamond' ? "'EB Garamond', Georgia, serif"
        : prefs.readerFont === 'merriweather' ? "'Merriweather', Georgia, serif"
            : prefs.readerFont === 'montserrat' ? "'Montserrat', system-ui, sans-serif"
                : prefs.readerFont === 'public-sans' ? "'Public Sans', system-ui, sans-serif"
                    : "Georgia, serif";

    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">{error}</p>
        </div>
    );

    if (!isReady) return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--line-2)', borderTopColor: 'var(--ink-3)' }} />
        </div>
    );

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{ background: 'var(--paper)' }}
        >
            <div style={{
                maxWidth: `${prefs.maxWidthCh}ch`,
                margin: '0 auto',
                padding: '3rem 1.5rem 6rem',
                fontFamily,
                fontSize: prefs.fontSize,
                lineHeight: prefs.lineHeight,
                color: 'var(--ink)',
                whiteSpace: isMarkdown ? undefined : 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {isMarkdown
                    ? <MarkdownContent source={content} />
                    : content
                }
            </div>
        </div>
    );
}

// Minimal markdown renderer — handles the most common elements
function MarkdownContent({ source }: { source: string }) {
    // Process inline markdown: bold, italic, code, links
    const renderInline = (text: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let i = 0, key = 0;

        while (i < text.length) {
            // Bold **text** or __text__
            const boldMatch = text.slice(i).match(/^(\*\*|__)(.+?)\1/);
            if (boldMatch) {
                parts.push(<strong key={key++}>{boldMatch[2]}</strong>);
                i += boldMatch[0].length; continue;
            }
            // Italic *text* or _text_
            const italicMatch = text.slice(i).match(/^(\*|_)(.+?)\1/);
            if (italicMatch) {
                parts.push(<em key={key++}>{italicMatch[2]}</em>);
                i += italicMatch[0].length; continue;
            }
            // Inline code `text`
            const codeMatch = text.slice(i).match(/^`([^`]+)`/);
            if (codeMatch) {
                parts.push(<code key={key++} style={{ fontFamily: 'monospace', background: 'var(--paper-2)', padding: '0 3px', borderRadius: 3 }}>{codeMatch[1]}</code>);
                i += codeMatch[0].length; continue;
            }
            // Plain char
            const charMatch = text.slice(i).match(/^[^*_`[]+/) ?? [text[i]];
            parts.push(charMatch[0]);
            i += charMatch[0].length;
        }
        return parts;
    };

    const lines = source.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Fenced code block
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(<pre key={key++} style={{ background: 'var(--paper-2)', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', fontSize: '0.85em' }}><code>{codeLines.join('\n')}</code></pre>);
                codeLines = []; inCodeBlock = false;
            } else { inCodeBlock = true; }
            continue;
        }
        if (inCodeBlock) { codeLines.push(line); continue; }

        // Headings
        const hMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (hMatch) {
            const level = hMatch[1].length;
            const sizes = ['2em', '1.6em', '1.3em', '1.1em', '1em', '0.9em'];
            elements.push(<div key={key++} style={{ fontWeight: 700, fontSize: sizes[level - 1], margin: `${level <= 2 ? '1.5em' : '1em'} 0 0.5em`, lineHeight: 1.2 }}>{renderInline(hMatch[2])}</div>);
            continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            elements.push(<hr key={key++} style={{ border: 0, borderTop: '1px solid var(--line)', margin: '2em 0' }} />);
            continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            elements.push(<blockquote key={key++} style={{ borderLeft: '3px solid var(--accent)', marginLeft: 0, paddingLeft: '1em', color: 'var(--ink-2)', fontStyle: 'italic' }}>{renderInline(line.slice(2))}</blockquote>);
            continue;
        }

        // Empty line → paragraph break
        if (!line.trim()) { elements.push(<div key={key++} style={{ height: '0.75em' }} />); continue; }

        // Default paragraph
        elements.push(<p key={key++} style={{ margin: '0 0 0.5em' }}>{renderInline(line)}</p>);
    }

    return <>{elements}</>;
}