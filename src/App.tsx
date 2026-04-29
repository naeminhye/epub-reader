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

  // Sync theme to <html> so shadcn dark mode tokens apply everywhere.
  // 'dark' class → shadcn dark mode; 'theme-sepia' is a custom class we handle separately.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-sepia');
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'sepia') root.classList.add('theme-sepia');
  }, [theme]);

  return (
    <LocaleProvider>
      <LibraryView />
      {isReaderOpen && <ReaderView />}
      <Toaster position="bottom-right" />
    </LocaleProvider>
  );
}