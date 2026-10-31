import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { AdminClassReps, usersHelp } from '@/features/users';

export const metadata: Metadata = { title: usersHelp.classRepAdmin.title };

export default function AdminClassRepsPage() {
  return (
    <>
      <PageHeader
        title={usersHelp.classRepAdmin.title}
        description={usersHelp.classRepAdmin.description}
      />
      <StaffOnly>
        <AdminTabs />
        <AdminClassReps />
      </StaffOnly>
    </>
  );
}
