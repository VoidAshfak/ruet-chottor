import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { AdminEventReview, eventsHelp } from '@/features/events';

export const metadata: Metadata = { title: eventsHelp.review.title };

export default function AdminEventReviewPage() {
  return (
    <>
      <PageHeader title={eventsHelp.review.title} description={eventsHelp.review.description} />
      <StaffOnly>
        <AdminTabs />
        <AdminEventReview />
      </StaffOnly>
    </>
  );
}
