'use client';

import { formatDateTime, REPORT_STATUSES, type ReportStatus } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useModerationQueue } from '../hooks/use-moderation';

/** Reported items, most-reported first. Staff only (the page wraps it in StaffOnly). */
export function ModerationQueue() {
  const [status, setStatus] = useState<ReportStatus>('open');
  const queue = useModerationQueue(status);
  const items = queue.data?.pages.flatMap((page) => page.items) ?? [];
  const text = help.queue;

  return (
    <section aria-labelledby="moderation-queue-heading" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="moderation-queue-heading" className="sr-only">
          {text.title}
        </h2>
        <Label htmlFor="queue-status">{text.status}</Label>
        <select
          id="queue-status"
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as ReportStatus)}
        >
          {REPORT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {text.statuses[option]}
            </option>
          ))}
        </select>
        <InfoTip text={help.tips.autoHide} label={text.title} />
      </div>

      {queue.isPending ? (
        <p role="status" className="text-muted-foreground">
          {text.loading}
        </p>
      ) : queue.isError ? (
        <div role="alert" className="rounded-lg border p-6 text-center">
          <p className="text-destructive">{queue.error.message ?? text.error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void queue.refetch()}>
            {text.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState>{text.empty}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={`${item.contentType}:${item.contentId}`} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{item.label}</span>
                {item.context ? (
                  <span className="text-muted-foreground">· {item.context}</span>
                ) : null}
                {item.contentStatus ? (
                  <span className="text-muted-foreground">
                    · {help.contentStatus[item.contentStatus]}
                  </span>
                ) : null}
                <span className="ml-auto font-medium">{text.reports(item.reportCount)}</span>
              </div>
              <p className="mt-2 line-clamp-3 break-words whitespace-pre-wrap">
                {item.preview ?? text.gone}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {text.by(item.author?.name ?? text.unknownAuthor)} ·{' '}
                {item.reasons.map((r) => `${help.reasons[r.reason]} (${r.count})`).join(', ')}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {text.firstReported}{' '}
                  <time dateTime={item.firstReportedAt}>
                    {formatDateTime(item.firstReportedAt)}
                  </time>
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/moderation/${item.contentType}/${item.contentId}`}>
                    {text.open}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {queue.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={queue.isFetchingNextPage}
            onClick={() => void queue.fetchNextPage()}
          >
            {text.loadMore}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
