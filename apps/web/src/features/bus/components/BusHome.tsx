'use client';

import { type BusNotice, type BusRoute, departuresFrom } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useNotices, useRoutes } from '../hooks/use-bus';
import { clock12, dhakaNow } from '../schedule';
import { LoginGate } from './LoginGate';
import { RouteMark } from './RouteMark';

const SHOW_NEXT = 6;

/** "2026-11-02" -> "2 Nov" */
function shortDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

export function NoticeList({ notices }: { notices: BusNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <section aria-labelledby="bus-notices" className="grid gap-2">
      <h2 id="bus-notices" className="sr-only">
        {help.notices.title}
      </h2>
      {notices.map((notice) => (
        <p
          key={notice.id}
          role="status"
          className="rounded-md border-l-4 border-brand-orange bg-muted px-3 py-2 text-sm"
        >
          <span className="font-medium">
            {notice.route ? (
              <RouteMark color={notice.route.color} name={notice.route.name} />
            ) : (
              help.notices.allRoutes
            )}
            :
          </span>{' '}
          {notice.message}{' '}
          <span className="text-muted-foreground">
            ({help.notices.until(shortDate(notice.endsOn))})
          </span>
        </p>
      ))}
    </section>
  );
}

function NextBuses({ routes }: { routes: BusRoute[] }) {
  const stopNames = [...new Set(routes.flatMap((r) => r.stops.map((s) => s.name)))].sort();
  const [stop, setStop] = useState('');
  // The clock moves on its own, so countdowns stay right while the page is open.
  const [now, setNow] = useState(() => dhakaNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(dhakaNow()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);
  const departures = stop
    ? departuresFrom(routes, stop, now.weekday, now.minutes).slice(0, SHOW_NEXT)
    : [];
  const text = help.next;

  return (
    <section aria-labelledby="next-buses" className="grid gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-1">
        <h2 id="next-buses" className="font-semibold">
          {text.title}
        </h2>
        <InfoTip text={text.tip} label={text.tipLabel} />
      </div>
      {stopNames.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text.noStops}</p>
      ) : (
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor="bus-stop">{text.stop}</Label>
          <select
            id="bus-stop"
            className="h-10 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          >
            <option value="">{text.pickStop}</option>
            {stopNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}
      {stop ? (
        departures.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.none}</p>
        ) : (
          <ul className="grid gap-2" aria-live="polite">
            {departures.map((d) => (
              <li
                key={`${d.routeId}-${d.direction}-${d.atMinutes}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2"
              >
                <span className="w-20 font-semibold">{clock12(d.atMinutes)}</span>
                <span className="text-sm text-primary">{text.in(d.atMinutes - now.minutes)}</span>
                <span className="text-sm">
                  <RouteMark color={d.color} name={d.routeName} /> · {help.directions[d.direction]}
                  {d.note ? ` · ${d.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function Home() {
  const routes = useRoutes();
  const notices = useNotices();
  const items = routes.data?.items ?? [];

  if (routes.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {help.routes.loading}
      </p>
    );
  }
  if (routes.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{routes.error.message || help.routes.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void routes.refetch()}>
          {help.routes.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <NoticeList notices={notices.data?.items ?? []} />
      <NextBuses routes={items} />
      <section aria-labelledby="bus-routes" className="grid gap-2">
        <h2 id="bus-routes" className="font-semibold">
          {help.routes.title}
        </h2>
        {items.length === 0 ? (
          <EmptyState>{help.routes.empty}</EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((route) => (
              <li key={route.id}>
                <Link
                  href={`/bus/${route.id}`}
                  className="grid gap-1 rounded-lg border p-3 hover:bg-accent focus-visible:bg-accent"
                >
                  <span className="font-medium">
                    <RouteMark color={route.color} name={route.name} />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {route.stops.map((s) => s.name).join(' → ')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {help.routes.stops(route.stops.length)} ·{' '}
                    {help.routes.trips(route.trips.length)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** /bus: notices, "next buses" from a stop, and every route. */
export function BusHome() {
  return <LoginGate>{() => <Home />}</LoginGate>;
}
