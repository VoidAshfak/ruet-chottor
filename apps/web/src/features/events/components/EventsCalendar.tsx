'use client';

import {
  type CampusEvent,
  dhakaDateKey,
  dhakaMonthRange,
  EVENT_CATEGORIES,
  type EventCategory,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { useManagedClubs } from '@/features/clubs';
import { dayLabel, eventsOn, monthGrid, monthLabel, shiftMonth } from '../calendar';
import { help } from '../help';
import { useEventRange } from '../hooks/use-events';
import { LoginGate } from './LoginGate';

const MAX_IN_CELL = 2;

function EventLine({ event }: { event: CampusEvent }) {
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent focus-visible:bg-accent"
      >
        <span className="w-16 shrink-0 text-sm font-medium text-primary">
          {new Intl.DateTimeFormat('en-GB', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Dhaka',
          })
            .format(new Date(event.startsAt))
            .toUpperCase()}
        </span>
        <span className="min-w-0">
          <span
            className={`block font-medium break-words ${event.cancelled ? 'line-through' : ''}`}
          >
            {event.title}
          </span>
          <span className="block text-sm text-muted-foreground">
            {[
              event.cancelled ? help.event.cancelled : null,
              help.categories[event.category],
              event.club?.name,
              event.venue,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Calendar({ role }: { role: string }) {
  const today = dhakaDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [category, setCategory] = useState<EventCategory | undefined>();
  // /events?club=<id>, from a club page.
  const clubId = useSearchParams().get('club') ?? undefined;
  const { from, to } = dhakaMonthRange(month);
  const events = useEventRange({
    from: from.toISOString(),
    to: to.toISOString(),
    clubId,
    category,
  });
  const managed = useManagedClubs({ enabled: true });
  const canCreate = (STAFF_ROLES as readonly string[]).includes(role) || managed.length > 0;
  const items = events.data?.items ?? [];
  const selectedEvents = selected.startsWith(month) ? eventsOn(items, selected) : [];
  const clubName = items.find((e) => e.club?.id === clubId)?.club?.name;
  const text = help.calendar;

  const goTo = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };

  return (
    <div className="grid gap-4">
      {clubId ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          {clubName ? text.clubFilter(clubName) : text.clubFilterUnknown}
          <Link href="/events" className="text-primary hover:underline">
            {text.clearClub}
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={text.filterLabel} className="flex flex-wrap gap-1">
          {[undefined, ...EVENT_CATEGORIES].map((option) => (
            <Button
              key={option ?? 'all'}
              size="sm"
              variant={category === option ? 'default' : 'outline'}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {option ? help.categories[option] : text.all}
            </Button>
          ))}
        </div>
        {canCreate ? (
          <Button asChild size="sm">
            <Link href="/events/new">{text.create}</Link>
          </Button>
        ) : null}
      </div>

      <section aria-labelledby="calendar-month" className="rounded-xl border p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text.previous}
            onClick={() => goTo(-1)}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <div className="flex items-center gap-2">
            <h2 id="calendar-month" className="font-semibold" aria-live="polite">
              {monthLabel(month)}
            </h2>
            <InfoTip text={text.tip} label={text.tipLabel} />
          </div>
          <div className="flex items-center gap-1">
            {month !== today.slice(0, 7) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
              >
                {text.today}
              </Button>
            ) : null}
            <Button variant="ghost" size="icon-sm" aria-label={text.next} onClick={() => goTo(1)}>
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse" aria-busy={events.isFetching}>
          <thead>
            <tr>
              {text.weekdays.map((day, index) => (
                <th
                  key={day}
                  scope="col"
                  abbr={text.weekdaysLong[index]}
                  className="pb-1 text-xs font-medium text-muted-foreground"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month).map((week, row) => (
              <tr key={row}>
                {week.map((day, col) => {
                  if (!day) return <td key={`${row}-${col}`} className="border-t p-0.5" />;
                  const dayEvents = eventsOn(items, day);
                  const isToday = day === today;
                  const isSelected = day === selected;
                  return (
                    <td key={day} className="border-t p-0.5 align-top">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={text.dayLabel(dayLabel(day), dayEvents.length)}
                        onClick={() => setSelected(day)}
                        className={`flex h-14 w-full flex-col items-center gap-0.5 rounded-md p-1 text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-24 sm:items-stretch ${
                          isSelected ? 'bg-accent ring-1 ring-primary' : ''
                        }`}
                      >
                        <span
                          className={`flex size-6 items-center justify-center rounded-full text-xs sm:self-end ${
                            isToday ? 'bg-primary font-semibold text-primary-foreground' : ''
                          }`}
                        >
                          {Number(day.slice(8))}
                        </span>
                        {/* Phones: a dot per day with events. Wider screens: short titles. */}
                        {dayEvents.length > 0 ? (
                          <span
                            aria-hidden
                            className="size-1.5 rounded-full bg-primary sm:hidden"
                          />
                        ) : null}
                        <span aria-hidden className="hidden w-full flex-col gap-0.5 sm:flex">
                          {dayEvents.slice(0, MAX_IN_CELL).map((event) => (
                            <span
                              key={event.id}
                              className={`truncate rounded bg-primary/10 px-1 text-left text-[11px] leading-4 text-primary ${
                                event.cancelled ? 'line-through opacity-60' : ''
                              }`}
                            >
                              {event.title}
                            </span>
                          ))}
                          {dayEvents.length > MAX_IN_CELL ? (
                            <span className="px-1 text-left text-[11px] text-muted-foreground">
                              {text.more(dayEvents.length - MAX_IN_CELL)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="selected-day" className="grid gap-2">
        <h2 id="selected-day" className="font-medium">
          {dayLabel(selected)}
        </h2>
        {events.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.loading}
          </p>
        ) : events.isError ? (
          <div role="alert" className="rounded-lg border p-4 text-center">
            <p className="text-destructive">{events.error.message || text.error}</p>
            <Button variant="outline" className="mt-3" onClick={() => void events.refetch()}>
              {text.retry}
            </Button>
          </div>
        ) : selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? text.monthEmpty : text.noEvents}
          </p>
        ) : (
          <ul className="grid gap-2">
            {selectedEvents.map((event) => (
              <EventLine key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** /events: the month calendar. Wrap in <Suspense> (reads ?club= from the URL). */
export function EventsCalendar() {
  return <LoginGate>{(user) => <Calendar role={user.role} />}</LoginGate>;
}
