'use client';

import {
  type ContentAction,
  type ContentStatus,
  formatDateTime,
  MODERATABLE_CONTENT_TYPES,
  type ModeratableContentType,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogEntry } from '@/features/admin';
import { ApiError } from '@/lib/api-client';
import { help } from '../help';
import { useContentAction, useModerationItem } from '../hooks/use-moderation';
import { ContentActionDialog } from './ContentActionDialog';

/** Actions that make sense for an item in this state. */
function availableActions(status: ContentStatus | null, openReports: number): ContentAction[] {
  const actions: ContentAction[] = [];
  if (status === 'visible') actions.push('hide', 'remove');
  if (status === 'hidden') actions.push('remove', 'restore');
  if (status === 'removed') actions.push('restore');
  if (openReports > 0) actions.push('dismiss');
  return actions;
}

/** The page passes URL segments; unknown content types get the "not found" message. */
export function ModerationItemDetail({
  contentType,
  contentId,
}: {
  contentType: string;
  contentId: string;
}) {
  if (!(MODERATABLE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.item.notFound}</p>;
  }
  return <ItemDetail contentType={contentType as ModeratableContentType} contentId={contentId} />;
}

function ItemDetail({
  contentType,
  contentId,
}: {
  contentType: ModeratableContentType;
  contentId: string;
}) {
  const detail = useModerationItem(contentType, contentId);
  const act = useContentAction(contentType, contentId);
  const [action, setAction] = useState<ContentAction | null>(null);
  const text = help.item;

  if (detail.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {help.queue.loading}
      </p>
    );
  }
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && [400, 404].includes(detail.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? text.notFound : detail.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/moderation">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const { item, reports, history } = detail.data;
  const openReports = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="grid gap-6">
      <Link href="/admin/moderation" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>

      <section className="rounded-lg border p-4" aria-label={item.label}>
        <p className="text-sm text-muted-foreground">
          {item.label}
          {item.context ? ` · ${item.context}` : ''}
        </p>
        <p className="mt-2 break-words whitespace-pre-wrap">{item.preview ?? help.queue.gone}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">{text.author}</dt>
          <dd>
            {item.author ? (
              <Link
                href={`/admin/users/${item.author.id}`}
                className="text-primary underline-offset-4 hover:underline"
                title={text.authorLink}
              >
                {item.author.name} ({item.author.roll})
              </Link>
            ) : (
              help.queue.unknownAuthor
            )}
          </dd>
          <dt className="text-muted-foreground">{text.status}</dt>
          <dd>{item.contentStatus ? help.contentStatus[item.contentStatus] : help.queue.gone}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {availableActions(item.contentStatus, openReports).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === 'restore' || option === 'dismiss' ? 'outline' : 'destructive'}
              onClick={() => setAction(option)}
            >
              {help.actions[option].button}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="item-reports">
        <h2 id="item-reports" className="mb-2 font-medium">
          {text.reports} ({reports.length})
        </h2>
        <ul className="grid gap-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium">{help.reasons[report.reason]}</span>{' '}
                <span className="text-muted-foreground">
                  · {help.queue.statuses[report.status]} ·{' '}
                  {text.reporter(report.reporter?.name ?? help.queue.unknownAuthor)} ·{' '}
                  <time dateTime={report.createdAt}>{formatDateTime(report.createdAt)}</time>
                </span>
              </p>
              {report.note ? (
                <p className="mt-1 break-words text-muted-foreground">{report.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="item-history">
        <h2 id="item-history" className="mb-2 font-medium">
          {text.history}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noHistory}</p>
        ) : (
          <ul className="grid gap-2">
            {history.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {action ? (
        <ContentActionDialog
          action={action}
          pending={act.isPending}
          error={act.error?.message}
          onClose={() => setAction(null)}
          onConfirm={(reason) =>
            act.mutate({ action, reason }, { onSuccess: () => setAction(null) })
          }
        />
      ) : null}
    </div>
  );
}
