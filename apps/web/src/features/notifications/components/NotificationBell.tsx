'use client';

import { BellIcon } from 'lucide-react';
import Link from 'next/link';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useUnreadCount } from '../hooks/use-notifications';
import { useNotificationsSocket } from '../hooks/use-notifications-socket';

/** Header bell with the unread count. It also holds the live connection while logged in. */
export function NotificationBell() {
  const session = useSession();
  const loggedIn = session.user !== null;
  useNotificationsSocket({ enabled: loggedIn });
  const unread = useUnreadCount({ enabled: loggedIn });
  if (!loggedIn) return null;

  const count = unread.data?.count ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={help.bell(count)}
      className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <BellIcon className="size-5" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-semibold text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
