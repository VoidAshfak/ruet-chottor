'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { ReportAction, useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { timeRange } from '../calendar';
import { help } from '../help';
import { useAttendees, useEvent, useEventActions } from '../hooks/use-events';
import { LoginGate } from './LoginGate';

function Detail({ id }: { id: string }) {
  const event = useEvent(id);
  const actions = useEventActions(id);
  const attendees = useAttendees(id, { enabled: !!event.data?.canEdit });
  const reported = useReportedIds('events.event', event.data && !event.data.canEdit ? [id] : []);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // When the page was opened; "is it over?" must not change between renders.
  const [openedAt] = useState(() => Date.now());
  const text = help.event;

  if (event.isPending) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (event.isError) {
    const missing = event.error instanceof ApiError && [400, 404].includes(event.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : event.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/events">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const data = event.data;
  const ended = Date.parse(data.endsAt) < openedAt;
  const rsvpError = actions.going.error?.message ?? actions.notGoing.error?.message;

  return (
    <article className="grid gap-5">
      <Link href="/events" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>
      {data.poster?.url ? (
        // Cloudinary serves a size that fits; next/image would resize it again on our server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.poster.url}
          alt=""
          className="max-h-80 w-full rounded-lg border object-cover"
        />
      ) : null}
      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">{help.categories[data.category]}</p>
        <h1
          className={`text-2xl font-semibold tracking-tight break-words ${data.cancelled ? 'line-through' : ''}`}
        >
          {data.title}
        </h1>
      </header>
      {data.cancelled ? (
        <p
          role="status"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {text.cancelledNote}
        </p>
      ) : null}
      {data.moderated ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.moderated}</p>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{text.when}</dt>
        <dd>{timeRange(data.startsAt, data.endsAt)}</dd>
        <dt className="text-muted-foreground">{text.where}</dt>
        <dd className="break-words">{data.venue}</dd>
        <dt className="text-muted-foreground">{text.organiser}</dt>
        <dd>
          {data.club ? (
            <Link href={`/clubs/${data.club.slug}`} className="text-primary hover:underline">
              {data.club.name}
            </Link>
          ) : (
            (data.organiser?.name ?? '—')
          )}
        </dd>
      </dl>

      {!data.cancelled && !data.moderated ? (
        <div className="grid gap-2 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            {data.capacity !== null
              ? text.capacity(data.goingCount, data.capacity)
              : text.goingCount(data.goingCount)}
          </p>
          {ended ? (
            <p className="text-sm">{text.ended}</p>
          ) : data.isGoing ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-primary">{text.youAreGoing}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={actions.notGoing.isPending}
                onClick={() => actions.notGoing.mutate()}
              >
                {text.notGoing}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                disabled={data.isFull || actions.going.isPending}
                onClick={() => actions.going.mutate()}
              >
                {data.isFull ? text.full : text.going}
              </Button>
              <InfoTip text={text.goingTip} label={text.goingTipLabel} />
            </div>
          )}
          <FormError message={rsvpError} />
        </div>
      ) : null}

      {data.description ? (
        <section aria-labelledby="event-about">
          <h2 id="event-about" className="mb-1 font-medium">
            {text.about}
          </h2>
          <p className="break-words whitespace-pre-line text-muted-foreground">
            {data.description}
          </p>
        </section>
      ) : null}

      {data.canEdit ? (
        <section aria-labelledby="event-attendees" className="grid gap-2">
          <h2 id="event-attendees" className="font-medium">
            {text.attendees} ({attendees.data?.items.length ?? data.goingCount})
          </h2>
          {attendees.data && attendees.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{text.noAttendees}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {attendees.data?.items.map((person) => (
                <li key={person.id}>
                  {person.name} <span className="text-muted-foreground">({person.roll})</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/events/${data.id}/edit`}>{text.edit}</Link>
            </Button>
            {data.cancelled ? null : (
              <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
                {text.cancel}
              </Button>
            )}
          </div>
        </section>
      ) : data.moderated ? null : (
        <div className="border-t pt-3">
          <ReportAction
            contentType="events.event"
            contentId={data.id}
            reported={reported.has(data.id)}
          />
        </div>
      )}

      {confirmCancel ? (
        <ConfirmDialog
          {...text.confirmCancel}
          pending={actions.cancel.isPending}
          error={actions.cancel.error?.message}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() =>
            actions.cancel.mutate(undefined, { onSuccess: () => setConfirmCancel(false) })
          }
        />
      ) : null}
    </article>
  );
}

/** /events/[id] */
export function EventDetail({ id }: { id: string }) {
  return <LoginGate>{() => <Detail id={id} />}</LoginGate>;
}
