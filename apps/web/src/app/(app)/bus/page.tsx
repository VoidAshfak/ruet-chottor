import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { BusHome, busHelp } from '@/features/bus';

export const metadata: Metadata = { title: busHelp.page.title };

export default function BusPage() {
  return (
    <>
      <PageHeader title={busHelp.page.title} description={busHelp.page.description} />
      <BusHome />
      <FirstVisitGuide moduleKey="bus" steps={busHelp.intro} />
    </>
  );
}
