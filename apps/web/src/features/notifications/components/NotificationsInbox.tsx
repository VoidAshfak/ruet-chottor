'use client';

import Link from 'next/link';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useMarkAllRead, useNotifications } from '../hooks/use-notifications';
import { NotificationItem } from './NotificationItem';

function Inbox() {
  const query = useNotifications({ enabled: true });
  const markAll = useMarkAllRead();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const anyUnread = items.some((item) => !item.read);

  if (query.isPending) {
    return (
      <ul className="grid gap-2" aria-label={help.list.loading}>
        {[0, 1, 2].map((row) => (
          <li key={row} className="h-20 animate-pulse rounded-lg border bg-muted" />
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{query.error.message || help.list.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {help.list.retry}
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-muted-foreground">{help.list.empty}</p>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!anyUnread || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          {help.markAll}
        </Button>
        <InfoTip text={help.markAllTip} label={help.markAllTipLabel} />
      </div>
      <ul className="grid gap-2" aria-label={help.list.label}>
        {items.map((item) => (
          <NotificationItem key={item.id} notification={item} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {help.list.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** /notifications: the member's inbox, newest first. */
export function NotificationsInbox() {
  const session = useSession();
  if (session.isPending) {
    return <div className="h-40 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (!session.user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.login}</Link>
        </Button>
      </div>
    );
  }
  return <Inbox />;
}
