import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminMembers, AdminTabs, adminHelp, StaffOnly } from '@/features/admin';

export const metadata: Metadata = { title: adminHelp.members.title };

export default function AdminMembersPage() {
  return (
    <>
      <PageHeader title={adminHelp.members.title} description={adminHelp.members.description} />
      <StaffOnly>
        <AdminTabs />
        <AdminMembers />
        <FirstVisitGuide moduleKey="admin" steps={adminHelp.intro} />
      </StaffOnly>
    </>
  );
}
