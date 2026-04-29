import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useReaderStore } from '@/stores/readerStore';
import { useT } from '@/lib/i18n/context';

interface ReadingProgressPanelProps {
    open: boolean;
    onClose: () => void;
    totalLocations: number; // from book.locations.length()
}

const AVG_WORDS_PER_PAGE = 250;
const AVG_READING_WPM = 250;

export function ReadingProgressPanel({ open, onClose, totalLocations }: ReadingProgressPanelProps) {
    const t = useT();
    const { currentBook, progress, pageInfo } = useReaderStore();

    if (!currentBook) return null;

    const pct = Math.round(progress * 100);

    // Estimate word counts from location count (epubjs generates ~1024 locations per book,
    // each location is roughly 1 "screen" ≈ 250 words at default font size)
    const estimatedTotalWords = totalLocations > 0
        ? totalLocations * AVG_WORDS_PER_PAGE
        : null;

    // const wordsRead = estimatedTotalWords ? Math.round(estimatedTotalWords * progress) : null;
    const wordsLeft = estimatedTotalWords ? Math.round(estimatedTotalWords * (1 - progress)) : null;

    // Pages are from epubjs chapter pagination — total is only for current chapter
    // Use progress to estimate book-wide pages from locations
    const totalPagesEstimate = totalLocations > 0 ? totalLocations : null;
    const pagesReadEstimate = totalPagesEstimate ? Math.round(totalPagesEstimate * progress) : null;
    const pagesLeftEstimate = totalPagesEstimate ? Math.round(totalPagesEstimate * (1 - progress)) : null;

    // Reading time estimate
    const minutesLeft = wordsLeft ? Math.round(wordsLeft / AVG_READING_WPM) : null;

    return (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <SheetContent side="right" className="w-full sm:max-w-xs flex flex-col gap-0 p-0">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <SheetTitle className="font-heading">{t.readingProgress}</SheetTitle>
                </SheetHeader>

                <div className="px-6 py-6 space-y-6 overflow-y-auto">

                    {/* Progress ring + percentage */}
                    <div className="flex flex-col items-center gap-3 py-4">
                        <ProgressRing pct={pct} />
                        <p className="text-sm text-muted-foreground">{t.progressPercent(pct)}</p>
                    </div>

                    {/* Stats grid */}
                    <div className="space-y-3">
                        {pagesReadEstimate !== null && (
                            <StatRow label={t.pagesRead(pagesReadEstimate)} value={`${pagesReadEstimate}`} />
                        )}
                        {pagesLeftEstimate !== null && (
                            <StatRow label={t.pagesLeft(pagesLeftEstimate)} value={`${pagesLeftEstimate}`} />
                        )}
                        {minutesLeft !== null && (
                            <StatRow label={t.timeLeft(minutesLeft)} value={formatTime(minutesLeft)} />
                        )}
                        {estimatedTotalWords !== null && (
                            <StatRow label={t.wordsEstimate(estimatedTotalWords)} value="" />
                        )}
                    </div>

                    {/* Current chapter position */}
                    {pageInfo && pageInfo.total > 1 && (
                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Current chapter</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-foreground/60 rounded-full transition-[width] duration-300"
                                        style={{ width: `${Math.round((pageInfo.page / pageInfo.total) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                    {pageInfo.page} / {pageInfo.total}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Book progress bar */}
                    <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-2">Book</p>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-foreground/70 rounded-full transition-[width] duration-500"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground/60 text-center">{t.avgReadingSpeed}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            {value && <span className="text-sm font-medium tabular-nums">{value}</span>}
        </div>
    );
}

function ProgressRing({ pct }: { pct: number }) {
    const r = 52;
    const circumference = 2 * Math.PI * r;
    const dash = (pct / 100) * circumference;

    return (
        <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Track */}
            <circle
                cx="64" cy="64" r={r}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
                cx="64" cy="64" r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={circumference / 4} // start at top
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
            {/* Center text */}
            <text
                x="64" y="60"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
                fontWeight="600"
                fill="currentColor"
            >
                {pct}%
            </text>
            <text
                x="64" y="82"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="currentColor"
                opacity="0.5"
            >
                read
            </text>
        </svg>
    );
}

function formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}