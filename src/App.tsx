import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { LibraryView } from '@/components/library/LibraryView';
import { ReaderView } from '@/components/reader/ReaderView';
import { useReaderStore } from '@/stores/readerStore';
import { LocaleProvider } from '@/lib/i18n/context';

export default function App() {
  const isReaderOpen = useReaderStore((s) => s.isReaderOpen);
  const loadPrefs = useReaderStore((s) => s.loadPrefs);
  const theme = useReaderStore((s) => s.prefs.theme);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // Sync theme to <html> — data-theme attr drives CSS variables,
  // 'dark' class drives shadcn dark mode tokens simultaneously.
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.classList.remove('dark', 'theme-sepia');
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else if (theme === 'sepia') {
      root.setAttribute('data-theme', 'cream');
      root.classList.add('theme-sepia');
    } else {
      root.setAttribute('data-theme', 'paper');
    }
  }, [theme]);

  return (
    <LocaleProvider>
      <LibraryView />
      {isReaderOpen && <ReaderView />}
      <Toaster position="bottom-right" />
    </LocaleProvider>
  );
}