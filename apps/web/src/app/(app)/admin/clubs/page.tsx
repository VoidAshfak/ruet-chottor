import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { AdminClubs, clubsHelp } from '@/features/clubs';

export const metadata: Metadata = { title: clubsHelp.admin.title };

export default function AdminClubsPage() {
  return (
    <>
      <PageHeader title={clubsHelp.admin.title} description={clubsHelp.admin.description} />
      <StaffOnly>
        <AdminTabs />
        <AdminClubs />
      </StaffOnly>
    </>
  );
}
