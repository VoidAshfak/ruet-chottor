import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { NewsFeed, newsHelp } from '@/features/news';

export const metadata: Metadata = { title: newsHelp.page.title };

export default function NewsPage() {
  return (
    <>
      <PageHeader title={newsHelp.page.title} description={newsHelp.page.description} />
      {/* The feed reads ?club= from the URL, so it renders in the browser only. */}
      <Suspense>
        <NewsFeed />
      </Suspense>
      <FirstVisitGuide moduleKey="news" steps={newsHelp.intro} />
    </>
  );
}
