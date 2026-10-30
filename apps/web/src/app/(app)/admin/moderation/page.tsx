import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, adminHelp, StaffOnly } from '@/features/admin';
import { ModerationQueue } from '@/features/moderation';

export const metadata: Metadata = { title: adminHelp.moderation.title };

export default function ModerationQueuePage() {
  return (
    <>
      <PageHeader
        title={adminHelp.moderation.title}
        description={adminHelp.moderation.description}
      />
      <StaffOnly>
        <AdminTabs />
        <ModerationQueue />
      </StaffOnly>
    </>
  );
}
