'use client';

import { formatDateTime, type Notification } from '@ruet-chottor/shared';
import { CalendarDaysIcon, NewspaperIcon, ShieldAlertIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { help } from '../help';
import { useMarkRead } from '../hooks/use-notifications';

const ICONS = {
  clubs: UsersIcon,
  news: NewspaperIcon,
  events: CalendarDaysIcon,
  moderation: ShieldAlertIcon,
} as const;

/** One notification. Opening its link marks it read; one without a link has a button for that. */
export function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkRead();
  const Icon = ICONS[notification.type.split('.')[0] as keyof typeof ICONS] ?? NewspaperIcon;
  const read = () => {
    if (!notification.read) markRead.mutate(notification.id);
  };

  const content = (
    <>
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn('break-words', !notification.read && 'font-semibold')}>
          {notification.title}
        </p>
        {notification.body ? (
          <p className="mt-0.5 text-sm break-words text-muted-foreground">{notification.body}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
          {notification.read ? null : (
            <>
              {' · '}
              <span className="font-medium text-primary">{help.list.unread}</span>
            </>
          )}
        </p>
      </div>
    </>
  );
  const box = cn(
    'flex gap-3 rounded-lg border p-3',
    notification.read ? 'bg-background' : 'border-primary/30 bg-accent',
  );

  return (
    <li>
      {notification.link ? (
        <Link
          href={notification.link}
          onClick={read}
          className={cn(
            box,
            'outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={box}>
          {content}
          {notification.read ? null : (
            <Button variant="ghost" size="sm" className="self-start" onClick={read}>
              {help.list.markRead}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
