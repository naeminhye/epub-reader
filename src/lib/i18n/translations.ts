export type Locale = 'en' | 'vi';

export const translations = {
    en: {
        // Library
        library: 'Library',
        libraryLoading: 'Loading…',
        libraryEmpty: 'Your library is empty. Drop an EPUB file to get started.',
        libraryBookCount: (n: number) => `${n} book${n === 1 ? '' : 's'}`,

        // Import drop zone
        addEpub: 'Add EPUB',
        importing: 'Importing…',
        readingFile: 'Reading file',
        dropOrClick: 'Drop or click to browse',
        importFailed: (name: string) => `Failed to import ${name}`,
        importAdded: (title: string) => `Added "${title}"`,

        // Book card
        open: 'Open',
        removeFromLibrary: 'Remove from library',
        removeConfirm: (title: string) => `Remove "${title}" from library?`,

        // Reader toolbar
        contents: 'Contents',
        search: 'Search',
        scroll: 'Scroll',
        pages: 'Pages',
        singlePage: '1pg',
        doublePage: '2pg',
        typography: 'Typography',
        font: 'Font',
        fontSize: 'Font size',
        lineHeight: 'Line height',
        fontEbGaramond: 'EB Garamond',
        fontMerriweather: 'Merriweather',
        fontSystemSerif: 'System serif',
        switchToScroll: 'Switch to scroll mode',
        switchToPages: 'Switch to page mode',
        themeLabel: (theme: string) => `Theme: ${theme}`,

        // Reader navigation
        prevChapter: 'Prev chapter',
        nextChapter: 'Next chapter',
        scrollMode: 'Scroll mode',
        prev: 'Prev',
        next: 'Next',
        openingBook: 'Opening book…',
        couldNotOpen: 'Could not open this book',
        epubCorrupted: 'The EPUB file may be corrupted or use unsupported features.',
        prevPage: 'Previous page',
        nextPage: 'Next page',

        // Selection popover
        selectionActions: 'Selection actions',
        translate: 'Translate',
        define: 'Define',
        highlight: 'Highlight (HL)',
        close: 'Close',
        color: 'Color:',
        translateTitle: 'Translate to Vietnamese',
        defineTitle: 'Look up definition',
        highlightTitle: 'Highlight',

        // Translation panel
        translationTitle: 'Translation',
        fromCache: 'From cache · instant',
        translating: 'Translating…',
        translationError: 'Error',
        original: 'Original',
        vietnamese: 'Vietnamese',
        copy: 'Copy',
        copied: 'Copied',
        couldNotCopy: 'Could not copy',
        retry: 'Retry',
        translatedBy: (model: string) => `Translated by ${model}`,
        fromCacheLabel: 'From cache · instant',

        // Search panel
        searchInBook: 'Search in book…',
        searching: 'Searching…',
        noResults: (q: string) => `No results for "${q}"`,
        resultCount: (n: number) => `${n} result${n !== 1 ? 's' : ''}`,

        // Stepper accessibility
        decrease: (label: string) => `Decrease ${label}`,
        increase: (label: string) => `Increase ${label}`,

        // Language toggle
        language: 'Language',

        // Status badges
        badgeNew: 'New',
        badgeReading: 'Reading',
        badgeDone: 'Done',

        // Auto-translate
        autoTranslate: 'Auto translate',
        autoTranslateOn: 'Auto translate: ON',
        autoTranslateOff: 'Auto translate: OFF',
        showOriginal: 'Show original',
        hideOriginal: 'Hide original',
        translatingPage: 'Translating page…',
    },

    vi: {
        // Library
        library: 'Thư viện',
        libraryLoading: 'Đang tải…',
        libraryEmpty: 'Thư viện trống. Thả file EPUB vào đây để bắt đầu.',
        libraryBookCount: (n: number) => `${n} cuốn sách`,

        // Import drop zone
        addEpub: 'Thêm EPUB',
        importing: 'Đang nhập…',
        readingFile: 'Đang đọc file',
        dropOrClick: 'Thả file hoặc nhấn để chọn',
        importFailed: (name: string) => `Nhập thất bại: ${name}`,
        importAdded: (title: string) => `Đã thêm "${title}"`,

        // Book card
        open: 'Mở',
        removeFromLibrary: 'Xóa khỏi thư viện',
        removeConfirm: (title: string) => `Xóa "${title}" khỏi thư viện?`,

        // Reader toolbar
        contents: 'Mục lục',
        search: 'Tìm kiếm',
        scroll: 'Cuộn',
        pages: 'Trang',
        singlePage: '1tr',
        doublePage: '2tr',
        typography: 'Kiểu chữ',
        font: 'Phông chữ',
        fontSize: 'Cỡ chữ',
        lineHeight: 'Khoảng cách dòng',
        fontEbGaramond: 'EB Garamond',
        fontMerriweather: 'Merriweather',
        fontSystemSerif: 'Serif hệ thống',
        switchToScroll: 'Chuyển sang chế độ cuộn',
        switchToPages: 'Chuyển sang chế độ trang',
        themeLabel: (theme: string) => `Giao diện: ${theme}`,

        // Reader navigation
        prevChapter: 'Chương trước',
        nextChapter: 'Chương sau',
        scrollMode: 'Chế độ cuộn',
        prev: 'Trước',
        next: 'Sau',
        openingBook: 'Đang mở sách…',
        couldNotOpen: 'Không thể mở sách này',
        epubCorrupted: 'File EPUB có thể bị hỏng hoặc không được hỗ trợ.',
        prevPage: 'Trang trước',
        nextPage: 'Trang sau',

        // Selection popover
        selectionActions: 'Thao tác với văn bản',
        translate: 'Dịch',
        define: 'Tra từ',
        highlight: 'Tô màu',
        close: 'Đóng',
        color: 'Màu:',
        translateTitle: 'Dịch sang tiếng Việt',
        defineTitle: 'Tra cứu định nghĩa',
        highlightTitle: 'Tô sáng văn bản',

        // Translation panel
        translationTitle: 'Bản dịch',
        fromCache: 'Từ bộ nhớ cache · tức thì',
        translating: 'Đang dịch…',
        translationError: 'Lỗi',
        original: 'Nguyên bản',
        vietnamese: 'Tiếng Việt',
        copy: 'Sao chép',
        copied: 'Đã sao chép',
        couldNotCopy: 'Không thể sao chép',
        retry: 'Thử lại',
        translatedBy: (model: string) => `Dịch bởi ${model}`,
        fromCacheLabel: 'Từ cache · tức thì',

        // Search panel
        searchInBook: 'Tìm trong sách…',
        searching: 'Đang tìm…',
        noResults: (q: string) => `Không tìm thấy kết quả cho "${q}"`,
        resultCount: (n: number) => `${n} kết quả`,

        // Stepper accessibility
        decrease: (label: string) => `Giảm ${label}`,
        increase: (label: string) => `Tăng ${label}`,

        // Language toggle
        language: 'Ngôn ngữ',

        // Status badges
        badgeNew: 'Mới',
        badgeReading: 'Đang đọc',
        badgeDone: 'Xong',

        // Auto-translate
        autoTranslate: 'Tự động dịch',
        autoTranslateOn: 'Tự động dịch: BẬT',
        autoTranslateOff: 'Tự động dịch: TẮT',
        showOriginal: 'Xem bản gốc',
        hideOriginal: 'Ẩn bản gốc',
        translatingPage: 'Đang dịch trang…',
    },
} as const;

export type TranslationKey = keyof typeof translations.en;
export type Translations = typeof translations.en;