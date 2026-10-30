import type { Metadata } from 'next';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { busHelp, RouteEditor } from '@/features/bus';

export const metadata: Metadata = { title: busHelp.editor.newTitle };

export default function NewBusRoutePage() {
  return (
    <StaffOnly>
      <AdminTabs />
      <RouteEditor />
    </StaffOnly>
  );
}
