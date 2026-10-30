import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { NewsArticle, newsHelp } from '@/features/news';

export const metadata: Metadata = { title: newsHelp.article.title };

export default function NewsArticlePage({ params }: PageProps<'/news/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <NewsArticle id={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="news" steps={newsHelp.intro} />
    </>
  );
}
