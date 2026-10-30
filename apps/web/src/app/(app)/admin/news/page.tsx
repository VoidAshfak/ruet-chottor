import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, adminHelp, StaffOnly } from '@/features/admin';
import { NewsReviewQueue } from '@/features/news';

export const metadata: Metadata = { title: adminHelp.newsReview.title };

export default function NewsReviewPage() {
  return (
    <>
      <PageHeader
        title={adminHelp.newsReview.title}
        description={adminHelp.newsReview.description}
      />
      <StaffOnly>
        <AdminTabs />
        <NewsReviewQueue />
      </StaffOnly>
    </>
  );
}
