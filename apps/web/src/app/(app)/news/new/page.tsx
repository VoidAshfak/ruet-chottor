import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { NewsEditor, newsHelp } from '@/features/news';

export const metadata: Metadata = { title: newsHelp.editor.newTitle };

export default function NewNewsPage() {
  return (
    <>
      <NewsEditor />
      <FirstVisitGuide moduleKey="news" steps={newsHelp.intro} />
    </>
  );
}
