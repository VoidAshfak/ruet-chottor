import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ListingForm, marketplaceHelp } from '@/features/marketplace';

export const metadata: Metadata = { title: marketplaceHelp.form.newTitle };

export default function NewListingPage() {
  return (
    <>
      <ListingForm />
      <FirstVisitGuide moduleKey="marketplace" steps={marketplaceHelp.intro} />
    </>
  );
}
