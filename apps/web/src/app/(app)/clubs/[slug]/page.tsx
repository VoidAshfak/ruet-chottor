import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ClubPage, clubsHelp } from '@/features/clubs';

export const metadata: Metadata = { title: clubsHelp.club.title };

export default function Page({ params }: PageProps<'/clubs/[slug]'>) {
  return (
    <>
      {/* The slug is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ slug }) => (
          <ClubPage slug={slug} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="clubs" steps={clubsHelp.intro} />
    </>
  );
}
