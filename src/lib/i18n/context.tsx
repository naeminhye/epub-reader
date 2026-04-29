import { createContext, useContext, useState, type ReactNode } from 'react';
import { translations, type Locale, type Translations } from './translations';

const STORAGE_KEY = 'epub-reader-locale';

interface LocaleContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: Translations;
}

const DEFAULT_CONTEXT: LocaleContextValue = {
    locale: 'en',
    setLocale: () => { },
    t: translations.en as Translations,
};

const LocaleContext = createContext<LocaleContextValue>(DEFAULT_CONTEXT);

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'en' || stored === 'vi' || stored === 'ko') return stored;
        } catch { /* ignore */ }
        const lang = navigator.language.toLowerCase();
        if (lang.startsWith('vi')) return 'vi';
        if (lang.startsWith('ko')) return 'ko';
        return 'en';
    });

    const setLocale = (l: Locale) => {
        setLocaleState(l);
        try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    };

    return (
        <LocaleContext.Provider value={{ locale, t: translations[locale] as Translations, setLocale }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    return useContext(LocaleContext);
}

export function useT(): Translations {
    return useContext(LocaleContext).t;
}