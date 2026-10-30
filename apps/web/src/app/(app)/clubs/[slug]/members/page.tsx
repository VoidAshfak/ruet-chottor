import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ClubMembers, clubsHelp } from '@/features/clubs';

export const metadata: Metadata = { title: clubsHelp.members.title };

export default function Page({ params }: PageProps<'/clubs/[slug]/members'>) {
  return (
    <>
      {/* The slug is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ slug }) => (
          <ClubMembers slug={slug} />
        ))}
      </Suspense>
    </>
  );
}
