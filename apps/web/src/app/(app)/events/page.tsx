import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { EventsCalendar, eventsHelp } from '@/features/events';

export const metadata: Metadata = { title: eventsHelp.page.title };

export default function EventsPage() {
  return (
    <>
      <PageHeader title={eventsHelp.page.title} description={eventsHelp.page.description} />
      {/* The calendar reads ?club= from the URL and today's date, so it renders in the browser only. */}
      <Suspense>
        <EventsCalendar />
      </Suspense>
      <FirstVisitGuide moduleKey="events" steps={eventsHelp.intro} />
    </>
  );
}
