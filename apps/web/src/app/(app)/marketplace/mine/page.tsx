import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { marketplaceHelp, MyListings } from '@/features/marketplace';

export const metadata: Metadata = { title: marketplaceHelp.mine.title };

export default function MyListingsPage() {
  return (
    <>
      <PageHeader
        title={marketplaceHelp.mine.title}
        description={marketplaceHelp.mine.description}
      />
      <MyListings />
    </>
  );
}
