import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { MyNews, newsHelp } from '@/features/news';

export const metadata: Metadata = { title: newsHelp.mine.title };

export default function MyNewsPage() {
  return (
    <>
      <PageHeader title={newsHelp.mine.title} description={newsHelp.mine.description} />
      <MyNews />
    </>
  );
}
