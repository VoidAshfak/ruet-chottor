import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { LostFoundBoard, lostFoundHelp } from '@/features/lost-found';

export const metadata: Metadata = { title: lostFoundHelp.page.title };

export default function LostFoundPage() {
  return (
    <>
      <PageHeader title={lostFoundHelp.page.title} description={lostFoundHelp.page.description} />
      <LostFoundBoard />
      <FirstVisitGuide moduleKey="lost-found" steps={lostFoundHelp.intro} />
    </>
  );
}
