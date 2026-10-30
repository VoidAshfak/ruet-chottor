import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminTabs, StaffOnly } from '@/features/admin';
import { busHelp, RouteEditor } from '@/features/bus';

export const metadata: Metadata = { title: busHelp.editor.editTitle };

export default function EditBusRoutePage({ params }: PageProps<'/admin/bus/[id]'>) {
  return (
    <StaffOnly>
      <AdminTabs />
      <Suspense>
        {params.then(({ id }) => (
          <RouteEditor id={id} />
        ))}
      </Suspense>
    </StaffOnly>
  );
}
