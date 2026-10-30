import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, adminHelp, ModerationLogView, StaffOnly } from '@/features/admin';

export const metadata: Metadata = { title: adminHelp.log.title };

export default function ModerationLogPage() {
  return (
    <>
      <PageHeader title={adminHelp.log.title} description={adminHelp.log.description} />
      <StaffOnly>
        <AdminTabs />
        <ModerationLogView />
      </StaffOnly>
    </>
  );
}
