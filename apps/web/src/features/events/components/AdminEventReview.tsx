'use client';

import { moderationReasonSchema } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { RuetLoader } from '@/components/art/RuetLoader';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { timeRange } from '../calendar';
import { classLabel } from '../class-label';
import { help } from '../help';
import { useEventDecision, useEventReviewQueue } from '../hooks/use-events';

/** Staff only (the page wraps it in StaffOnly): approve or turn down waiting class events. */
export function AdminEventReview() {
  const text = help.review;
  const queue = useEventReviewQueue();
  const decide = useEventDecision();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const items = queue.data?.pages.flatMap((page) => page.items) ?? [];

  const close = () => {
    setRejecting(null);
    setReason('');
    setReasonError(undefined);
  };

  if (queue.isPending) return <RuetLoader label={text.loading} />;
  if (queue.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p>{text.error}</p>
        <Button variant="outline" className="mt-3" onClick={() => void queue.refetch()}>
          {text.retry}
        </Button>
      </div>
    );
  }
  if (items.length === 0) return <EmptyState>{text.empty}</EmptyState>;

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {items.map((event) => (
          <li key={event.id} className="grid gap-2 rounded-lg border p-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {[
                  help.categories[event.category],
                  event.class ? classLabel(event.class) : null,
                  event.organiser ? text.by(event.organiser.name) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <Link
                href={`/events/${event.id}`}
                className="font-medium break-words text-primary hover:underline"
              >
                {event.title}
              </Link>
              <p className="text-sm">
                {timeRange(event.startsAt, event.endsAt)} · {event.venue}
              </p>
              {event.goingCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {text.edited} · {help.event.goingCount(event.goingCount)}
                </p>
              ) : null}
            </div>
            {event.description ? (
              <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
                {event.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={decide.approve.isPending}
                onClick={() => decide.approve.mutate(event.id)}
              >
                {text.approve}
              </Button>
              <InfoTip text={text.approveTip} label={text.approveTipLabel} />
              <Button size="sm" variant="destructive" onClick={() => setRejecting(event.id)}>
                {text.reject}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {queue.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={queue.isFetchingNextPage}
          onClick={() => void queue.fetchNextPage()}
        >
          {queue.isFetchingNextPage ? text.loadingMore : text.more}
        </Button>
      ) : null}
      {decide.approve.isSuccess ? (
        <p role="status" className="sr-only">
          {text.approved}
        </p>
      ) : null}
      {decide.approve.error ? (
        <p role="alert" className="text-sm text-destructive">
          {decide.approve.error.message}
        </p>
      ) : null}

      {rejecting ? (
        <ConfirmDialog
          title={text.rejectTitle}
          body={text.rejectBody}
          confirm={text.reject}
          cancel={text.cancel}
          pending={decide.reject.isPending}
          error={reasonError ?? decide.reject.error?.message}
          onClose={close}
          onConfirm={() => {
            const parsed = moderationReasonSchema.safeParse(reason);
            if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
            decide.reject.mutate({ id: rejecting, reason: parsed.data }, { onSuccess: close });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="event-review-reason">{text.reason}</Label>
            <textarea
              id="event-review-reason"
              rows={3}
              value={reason}
              placeholder={text.reasonPlaceholder}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
