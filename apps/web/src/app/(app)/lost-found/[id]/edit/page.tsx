import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ItemForm, lostFoundHelp } from '@/features/lost-found';

export const metadata: Metadata = { title: lostFoundHelp.form.editTitle };

export default function EditLostFoundPage({ params }: PageProps<'/lost-found/[id]/edit'>) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <ItemForm id={id} />
      ))}
    </Suspense>
  );
}
