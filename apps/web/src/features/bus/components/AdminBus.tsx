'use client';

import { busNoticeInputSchema, dhakaDateKey, type BusNotice } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useNoticeActions, useNotices, useRoutes } from '../hooks/use-bus';
import { RouteMark } from './RouteMark';

const fieldClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function NoticeForm() {
  const routes = useRoutes({ all: true });
  const actions = useNoticeActions();
  const today = dhakaDateKey(new Date());
  const [routeId, setRouteId] = useState('');
  const [message, setMessage] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [error, setError] = useState<string>();
  const text = help.admin;

  return (
    <form
      noValidate
      className="grid gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = busNoticeInputSchema.safeParse({ routeId, message, startsOn, endsOn });
        if (!parsed.success) return setError(parsed.error.issues[0]?.message);
        setError(undefined);
        actions.create.mutate(parsed.data, { onSuccess: () => setMessage('') });
      }}
    >
      <h3 className="font-medium">{text.newNotice}</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
        <div className="grid gap-1">
          <Label htmlFor="bus-notice-route">{text.noticeRoute}</Label>
          <select
            id="bus-notice-route"
            className={fieldClass}
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
          >
            <option value="">{help.notices.allRoutes}</option>
            {routes.data?.items.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="bus-notice-from">{text.startsOn}</Label>
          <Input
            id="bus-notice-from"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="bus-notice-until">{text.endsOn}</Label>
          <Input
            id="bus-notice-until"
            type="date"
            value={endsOn}
            min={startsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="bus-notice-message">{text.noticeMessage}</Label>
        <Input
          id="bus-notice-message"
          value={message}
          placeholder={text.noticePlaceholder}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <FormError message={error ?? actions.create.error?.message} />
      <Button
        type="submit"
        size="sm"
        className="justify-self-start"
        disabled={actions.create.isPending}
      >
        {text.post}
      </Button>
    </form>
  );
}

function Panel() {
  const routes = useRoutes({ all: true });
  const notices = useNotices({ all: true });
  const actions = useNoticeActions();
  const [deleting, setDeleting] = useState<BusNotice | null>(null);
  const text = help.admin;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="admin-bus-routes" className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="admin-bus-routes" className="font-semibold">
            {text.routes}
          </h2>
          <Button asChild size="sm">
            <Link href="/admin/bus/new">{text.newRoute}</Link>
          </Button>
        </div>
        {routes.isPending ? (
          <p role="status" className="text-muted-foreground">
            {help.routes.loading}
          </p>
        ) : (routes.data?.items.length ?? 0) === 0 ? (
          <p className="rounded-lg border p-6 text-center text-muted-foreground">
            {help.routes.empty}
          </p>
        ) : (
          <ul className="grid gap-2">
            {routes.data?.items.map((route) => (
              <li
                key={route.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <span className="min-w-0 flex-1">
                  <RouteMark color={route.color} name={route.name} />{' '}
                  <span className="text-sm text-muted-foreground">
                    · {help.routes.stops(route.stops.length)} ·{' '}
                    {help.routes.trips(route.trips.length)}
                    {route.active ? '' : ` · ${text.inactive}`}
                  </span>
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/bus/${route.id}`}>{text.edit}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-bus-notices" className="grid gap-3">
        <h2 id="admin-bus-notices" className="font-semibold">
          {text.notices}
        </h2>
        <NoticeForm />
        {(notices.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noNotices}</p>
        ) : (
          <ul className="grid gap-2">
            {notices.data?.items.map((notice) => (
              <li
                key={notice.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-medium">
                    {notice.route ? (
                      <RouteMark color={notice.route.color} name={notice.route.name} />
                    ) : (
                      help.notices.allRoutes
                    )}
                  </span>{' '}
                  · {notice.startsOn} – {notice.endsOn} · {notice.message}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(notice)}>
                  {text.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleting ? (
        <ConfirmDialog
          {...text.confirmDeleteNotice}
          pending={actions.remove.isPending}
          error={actions.remove.error?.message}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            actions.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
          }
        />
      ) : null}
    </div>
  );
}

/** /admin/bus (admins only; the API checks too). */
export function AdminBus() {
  const session = useSession();
  if (session.isPending) return null;
  if (session.user?.role !== 'admin') {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.admin.adminOnly}</p>;
  }
  return <Panel />;
}
