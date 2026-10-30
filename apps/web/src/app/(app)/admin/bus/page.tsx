import type { Metadata } from 'next';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { AdminBus, busHelp } from '@/features/bus';

export const metadata: Metadata = { title: busHelp.admin.title };

export default function AdminBusPage() {
  return (
    <>
      <PageHeader title={busHelp.admin.title} description={busHelp.admin.description} />
      <StaffOnly>
        <AdminTabs />
        <AdminBus />
      </StaffOnly>
    </>
  );
}
