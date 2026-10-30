import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventForm, eventsHelp } from '@/features/events';

export const metadata: Metadata = { title: eventsHelp.form.editTitle };

export default function EditEventPage({ params }: PageProps<'/events/[id]/edit'>) {
  return (
    <Suspense>
      {params.then(({ id }) => (
        <EventForm id={id} />
      ))}
    </Suspense>
  );
}
