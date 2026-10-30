import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminMemberDetail, AdminTabs, adminHelp, StaffOnly } from '@/features/admin';

export const metadata: Metadata = { title: adminHelp.member.title };

export default function AdminMemberPage({ params }: PageProps<'/admin/users/[id]'>) {
  return (
    <>
      <PageHeader title={adminHelp.member.title} description={adminHelp.member.description} />
      <StaffOnly>
        <AdminTabs />
        {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
        <Suspense>
          {params.then(({ id }) => (
            <AdminMemberDetail userId={id} />
          ))}
        </Suspense>
      </StaffOnly>
    </>
  );
}
