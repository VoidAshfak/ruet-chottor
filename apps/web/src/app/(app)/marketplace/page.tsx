import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { MarketBrowse, marketplaceHelp } from '@/features/marketplace';

export const metadata: Metadata = { title: marketplaceHelp.page.title };

export default function MarketplacePage() {
  return (
    <>
      <PageHeader
        title={marketplaceHelp.page.title}
        description={marketplaceHelp.page.description}
      />
      <MarketBrowse />
      <FirstVisitGuide moduleKey="marketplace" steps={marketplaceHelp.intro} />
    </>
  );
}
