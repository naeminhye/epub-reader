import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { LibraryView } from '@/components/library/LibraryView';
import { ReaderView } from '@/components/reader/ReaderView';
import { useReaderStore } from '@/stores/readerStore';
import { LocaleProvider } from '@/lib/i18n/context';

export default function App() {
  const isReaderOpen = useReaderStore((s) => s.isReaderOpen);
  const loadPrefs = useReaderStore((s) => s.loadPrefs);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  return (
    <LocaleProvider>
      <LibraryView />
      {isReaderOpen && <ReaderView />}
      <Toaster position="bottom-right" />
    </LocaleProvider>
  );
}