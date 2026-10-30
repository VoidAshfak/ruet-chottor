import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ItemDetail, lostFoundHelp } from '@/features/lost-found';

export const metadata: Metadata = { title: lostFoundHelp.item.title };

export default function LostFoundItemPage({ params }: PageProps<'/lost-found/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <ItemDetail id={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="lost-found" steps={lostFoundHelp.intro} />
    </>
  );
}
