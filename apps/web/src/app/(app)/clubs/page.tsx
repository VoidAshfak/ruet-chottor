import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { ClubsDirectory, clubsHelp } from '@/features/clubs';

export const metadata: Metadata = { title: clubsHelp.page.title };

export default function ClubsPage() {
  return (
    <>
      <PageHeader title={clubsHelp.page.title} description={clubsHelp.page.description} />
      <ClubsDirectory />
      <FirstVisitGuide moduleKey="clubs" steps={clubsHelp.intro} />
    </>
  );
}
