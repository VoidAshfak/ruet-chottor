import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { DirectorySearch, directoryHelp } from '@/features/directory';

export const metadata: Metadata = { title: directoryHelp.page.title };

export default function DirectoryPage() {
  return (
    <>
      <PageHeader title={directoryHelp.page.title} description={directoryHelp.page.description} />
      {/* DirectorySearch keeps its filters in the URL, so it renders in the browser only. */}
      <Suspense>
        <DirectorySearch />
      </Suspense>
      <FirstVisitGuide moduleKey="directory" steps={directoryHelp.intro} />
    </>
  );
}
