import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ClubEditor, clubsHelp } from '@/features/clubs';

export const metadata: Metadata = { title: clubsHelp.editor.title };

export default function Page({ params }: PageProps<'/clubs/[slug]/edit'>) {
  return (
    <>
      {/* The slug is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ slug }) => (
          <ClubEditor slug={slug} />
        ))}
      </Suspense>
    </>
  );
}
