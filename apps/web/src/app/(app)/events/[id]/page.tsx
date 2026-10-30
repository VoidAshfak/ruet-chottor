import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { EventDetail, eventsHelp } from '@/features/events';

export const metadata: Metadata = { title: eventsHelp.detail.title };

export default function EventPage({ params }: PageProps<'/events/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <EventDetail id={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="events" steps={eventsHelp.intro} />
    </>
  );
}
