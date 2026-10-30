import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewsEditor, newsHelp } from '@/features/news';

export const metadata: Metadata = { title: newsHelp.editor.editTitle };

export default function EditNewsPage({ params }: PageProps<'/news/[id]/edit'>) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <NewsEditor id={id} />
      ))}
    </Suspense>
  );
}
