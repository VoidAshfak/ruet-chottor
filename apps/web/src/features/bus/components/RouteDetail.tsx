'use client';

import { BUS_DIRECTIONS, clockToMinutes } from '@ruet-chottor/shared';
import Link from 'next/link';
import { RuetLoader } from '@/components/art/RuetLoader';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { help } from '../help';
import { useNotices, useRoute } from '../hooks/use-bus';
import { clock12, daysLabel } from '../schedule';
import { NoticeList } from './BusHome';
import { LoginGate } from './LoginGate';
import { colorClass, RouteMark } from './RouteMark';

function Detail({ id }: { id: string }) {
  const route = useRoute(id);
  const notices = useNotices();
  const text = help.detail;

  if (route.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (route.isError) {
    const missing = route.error instanceof ApiError && [400, 404].includes(route.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : route.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/bus">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const data = route.data;
  const first = data.stops[0]?.name ?? '';
  const last = data.stops.at(-1)?.name ?? '';
  const routeNotices = (notices.data?.items ?? []).filter(
    (n) => !n.route || n.route.id === data.id,
  );

  return (
    <article className="grid gap-6">
      <Link href="/bus" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          <RouteMark color={data.color} name={data.name} />
        </h1>
        {data.description ? <p className="text-muted-foreground">{data.description}</p> : null}
        {data.active ? null : <p className="text-sm text-muted-foreground">{text.inactive}</p>}
      </header>
      <NoticeList notices={routeNotices} />

      <section aria-labelledby="route-stops">
        <h2 id="route-stops" className="mb-2 font-semibold">
          {text.stops}
        </h2>
        <ol className="grid gap-0">
          {data.stops.map((stop, index) => (
            <li key={stop.id} className="relative flex items-center gap-3 py-1.5 pl-1">
              {/* The line between stops, in the route's colour. */}
              {index < data.stops.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute top-1/2 left-[9px] h-full w-0.5 ${colorClass(data.color)}`}
                />
              ) : null}
              <span
                aria-hidden
                className={`relative z-10 size-3 shrink-0 rounded-full border-2 border-background ${colorClass(data.color)}`}
              />
              <span className="flex-1">{stop.name}</span>
              <span className="text-sm text-muted-foreground">
                {text.minutes(stop.minutesFromCampus)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="route-timetable" className="grid gap-4">
        <h2 id="route-timetable" className="font-semibold">
          {text.timetable}
        </h2>
        {BUS_DIRECTIONS.map((direction) => {
          const trips = data.trips
            .filter((t) => t.direction === direction)
            .sort((a, b) => clockToMinutes(a.departsAt) - clockToMinutes(b.departsAt));
          return (
            <div key={direction} className="grid gap-1">
              <h3 className="font-medium">{help.directions[direction]}</h3>
              <p className="text-xs text-muted-foreground">
                {text.leavesFrom(direction === 'from_campus' ? first : last)}
              </p>
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground">{text.noTrips}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th scope="col" className="py-1 font-medium">
                        {text.departs}
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        {text.runs}
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        {text.note}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id} className="border-t">
                        <td className="py-1.5 font-medium">
                          {clock12(clockToMinutes(trip.departsAt))}
                        </td>
                        <td className="py-1.5">{daysLabel(trip.days)}</td>
                        <td className="py-1.5 text-muted-foreground">{trip.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </section>
    </article>
  );
}

/** /bus/[id]: stops and the full timetable of one route. */
export function RouteDetail({ id }: { id: string }) {
  return <LoginGate>{() => <Detail id={id} />}</LoginGate>;
}
