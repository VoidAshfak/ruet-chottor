import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ListingDetail, marketplaceHelp } from '@/features/marketplace';

export const metadata: Metadata = { title: marketplaceHelp.listing.title };

export default function ListingPage({ params }: PageProps<'/marketplace/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <ListingDetail id={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="marketplace" steps={marketplaceHelp.intro} />
    </>
  );
}
