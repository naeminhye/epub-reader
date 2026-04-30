/**
 * translations.ts — loads locale JSON files and exposes a typed Translations object.
 *
 * Plain strings live in locales/{locale}.json.
 * Interpolated strings use {placeholder} syntax in JSON and are converted to
 * functions here so callers use the same `t.key(params)` API as before.
 *
 * To add a new locale: create locales/{code}.json with the same keys and add
 * the code to the Locale union below.
 */

import en from './locales/en.json';
import vi from './locales/vi.json';
import ko from './locales/ko.json';

export type Locale = 'en' | 'vi' | 'ko';

type RawLocale = typeof en;

/** Replace {placeholder} tokens in a string */
function interp(str: string, params: Record<string, string | number>): string {
    return str.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

/** Build the full typed translations object from a raw JSON locale */
function buildTranslations(raw: RawLocale) {
    return {
        // ── Plain strings (returned as-is) ──────────────────────────────────
        library: raw.library,
        libraryLoading: raw.libraryLoading,
        libraryEmpty: raw.libraryEmpty,
        addEpub: raw.addEpub,
        importing: raw.importing,
        readingFile: raw.readingFile,
        dropOrClick: raw.dropOrClick,
        open: raw.open,
        removeFromLibrary: raw.removeFromLibrary,
        continueReading: raw.continueReading,
        resume: raw.resume,
        bookTitle: raw.bookTitle,
        author: raw.author,
        progress: raw.progress,
        lastRead: raw.lastRead,
        contents: raw.contents,
        search: raw.search,
        scroll: raw.scroll,
        pages: raw.pages,
        singlePage: raw.singlePage,
        doublePage: raw.doublePage,
        typography: raw.typography,
        font: raw.font,
        fontSize: raw.fontSize,
        lineHeight: raw.lineHeight,
        fontEbGaramond: raw.fontEbGaramond,
        fontMerriweather: raw.fontMerriweather,
        fontMontserrat: raw.fontMontserrat,
        fontPublicSans: raw.fontPublicSans,
        fontSystemSerif: raw.fontSystemSerif,
        switchToScroll: raw.switchToScroll,
        switchToPages: raw.switchToPages,
        prevChapter: raw.prevChapter,
        nextChapter: raw.nextChapter,
        scrollMode: raw.scrollMode,
        prev: raw.prev,
        next: raw.next,
        openingBook: raw.openingBook,
        couldNotOpen: raw.couldNotOpen,
        epubCorrupted: raw.epubCorrupted,
        prevPage: raw.prevPage,
        nextPage: raw.nextPage,
        selectionActions: raw.selectionActions,
        translate: raw.translate,
        define: raw.define,
        highlight: raw.highlight,
        close: raw.close,
        color: raw.color,
        translateTitle: raw.translateTitle,
        defineTitle: raw.defineTitle,
        highlightTitle: raw.highlightTitle,
        translationTitle: raw.translationTitle,
        fromCache: raw.fromCache,
        fromCacheLabel: raw.fromCacheLabel,
        translating: raw.translating,
        translationError: raw.translationError,
        original: raw.original,
        copy: raw.copy,
        copied: raw.copied,
        couldNotCopy: raw.couldNotCopy,
        retry: raw.retry,
        targetLanguage: raw.targetLanguage,
        searchTitleOrAuthor: raw.searchTitleOrAuthor,
        searchInBook: raw.searchInBook,
        searching: raw.searching,
        language: raw.language,
        badgeNew: raw.badgeNew,
        badgeReading: raw.badgeReading,
        badgeDone: raw.badgeDone,
        rateLimited: raw.rateLimited,
        allModelsFailed: raw.allModelsFailed,
        rateLimitRetry: raw.rateLimitRetry,
        rateLimitDismiss: raw.rateLimitDismiss,
        readingProgress: raw.readingProgress,
        avgReadingSpeed: raw.avgReadingSpeed,
        study: raw.study,
        studyGroup: raw.studyGroup,
        studyTerm: raw.studyTerm,
        studyNote: raw.studyNote,
        studyAdd: raw.studyAdd,
        studyAdded: raw.studyAdded,
        studyExport: raw.studyExport,
        studyEmpty: raw.studyEmpty,
        studyDelete: raw.studyDelete,
        studyDeleteConfirm: raw.studyDeleteConfirm,
        studyTermPlaceholder: raw.studyTermPlaceholder,
        studyNotePlaceholder: raw.studyNotePlaceholder,
        wordLookup: raw.wordLookup,
        wordLookupPlaceholder: raw.wordLookupPlaceholder,
        wordNotFound: raw.wordNotFound,
        wordNotFoundHint: raw.wordNotFoundHint,
        phonetics: raw.phonetics,
        definitions: raw.definitions,
        synonyms: raw.synonyms,
        searchGoogle: raw.searchGoogle,
        searchWikipedia: raw.searchWikipedia,
        searchYouTube: raw.searchYouTube,
        wikiSummary: raw.wikiSummary,
        wikiReadMore: raw.wikiReadMore,
        autoTranslate: raw.autoTranslate,
        autoTranslateOn: raw.autoTranslateOn,
        autoTranslateOff: raw.autoTranslateOff,
        autoTranslateWarning: raw.autoTranslateWarning,
        howToTranslate: raw.howToTranslate,
        showTranslation: raw.showTranslation,
        hideTranslation: raw.hideTranslation,
        translatingPage: raw.translatingPage,
        translationSettings: raw.translationSettings,
        translationEngine: raw.translationEngine,
        translationEngineDesc: raw.translationEngineDesc,
        apiKeySection: raw.apiKeySection,
        apiKeyDesc: raw.apiKeyDesc,
        apiKeyPlaceholder: raw.apiKeyPlaceholder,
        apiKeySaved: raw.apiKeySaved,
        apiKeyCleared: raw.apiKeyCleared,
        modelSelection: raw.modelSelection,
        openSettings: raw.openSettings,
        settingsSaved: raw.settingsSaved,
        errInvalidKey: raw.errInvalidKey,
        errRateLimited: raw.errRateLimited,
        errKeyBlocked: raw.errKeyBlocked,
        errNetwork: raw.errNetwork,
        errAllModelsFailed: raw.errAllModelsFailed,
        errUnknown: raw.errUnknown,
        errGoToSettings: raw.errGoToSettings,

        // ── Interpolated strings (converted to functions) ───────────────────
        libraryBookCount: (n: number) => interp(raw.libraryBookCount, { n }),
        importFailed: (name: string) => interp(raw.importFailed, { name }),
        importAdded: (title: string) => interp(raw.importAdded, { title }),
        removeConfirm: (title: string) => interp(raw.removeConfirm, { title }),
        themeLabel: (theme: string) => interp(raw.themeLabel, { theme }),
        translatedBy: (model: string) => interp(raw.translatedBy, { model }),
        noResults: (q: string) => interp(raw.noResults, { q }),
        resultCount: (n: number) => interp(raw.resultCount, { n }),
        decrease: (label: string) => interp(raw.decrease, { label }),
        increase: (label: string) => interp(raw.increase, { label }),
        rateLimitedWithTime: (s: number) => interp(raw.rateLimitedWithTime, { s }),
        progressPercent: (n: number) => interp(raw.progressPercent, { n }),
        pagesRead: (n: number) => interp(raw.pagesRead, { n }),
        pagesLeft: (n: number) => interp(raw.pagesLeft, { n }),
        wordsEstimate: (n: number) => interp(raw.wordsEstimate, { n: n.toLocaleString() }),
        timeLeft: (min: number) => min < 60
            ? interp(raw.timeLeft_min, { min })
            : interp(raw.timeLeft_hr, { h: Math.round(min / 60), m: min % 60 }),

        // targetLanguageName — looks up prefixed key in JSON
        targetLanguageName: (code: string): string =>
            (raw as Record<string, string>)[`targetLanguageName_${code}`] ?? code,

        // translationLangLabel — same lookup, same data
        translationLangLabel: (code: string): string =>
            (raw as Record<string, string>)[`targetLanguageName_${code}`] ?? code,
    } as const;
}

export const translations = {
    en: buildTranslations(en),
    vi: buildTranslations(vi),
    ko: buildTranslations(ko),
} as const;

export type Translations = ReturnType<typeof buildTranslations>;
export type TranslationKey = keyof Translations;