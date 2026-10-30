import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListingForm, marketplaceHelp } from '@/features/marketplace';

export const metadata: Metadata = { title: marketplaceHelp.form.editTitle };

export default function EditListingPage({ params }: PageProps<'/marketplace/[id]/edit'>) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ListingForm id={id} />
      ))}
    </Suspense>
  );
}
