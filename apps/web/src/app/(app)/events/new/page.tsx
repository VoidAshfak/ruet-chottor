import type { Metadata } from 'next';
import { EventForm, eventsHelp } from '@/features/events';

export const metadata: Metadata = { title: eventsHelp.form.newTitle };

export default function NewEventPage() {
  return <EventForm />;
}
