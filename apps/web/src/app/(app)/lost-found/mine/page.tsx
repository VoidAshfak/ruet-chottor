import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { lostFoundHelp, MyItems } from '@/features/lost-found';

export const metadata: Metadata = { title: lostFoundHelp.mine.title };

export default function MyLostFoundPage() {
  return (
    <>
      <PageHeader title={lostFoundHelp.mine.title} description={lostFoundHelp.mine.description} />
      <MyItems />
    </>
  );
}
