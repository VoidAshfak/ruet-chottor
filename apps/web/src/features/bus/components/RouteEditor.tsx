'use client';

import {
  BUS_COLORS,
  BUS_DIRECTIONS,
  BUS_LIMITS,
  type BusColor,
  type BusDirection,
  type BusRoute,
  busRouteInputSchema,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { PageHeader } from '@/components/guide/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useDeleteRoute, useRoute, useSaveRoute } from '../hooks/use-bus';
import { colorClass } from './RouteMark';

type StopRow = { key: string; name: string; minutes: string };
type TripRow = {
  key: string;
  direction: BusDirection;
  departsAt: string;
  days: number[];
  note: string;
};

const fieldClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
const key = () => crypto.randomUUID();

function Editor({ existing }: { existing?: BusRoute }) {
  const router = useRouter();
  const save = useSaveRoute(existing?.id);
  const remove = useDeleteRoute();
  const text = help.editor;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [color, setColor] = useState<BusColor>(existing?.color ?? 'blue');
  const [active, setActive] = useState(existing?.active ?? true);
  const [stops, setStops] = useState<StopRow[]>(
    existing?.stops.map((s) => ({
      key: key(),
      name: s.name,
      minutes: String(s.minutesFromCampus),
    })) ?? [
      { key: key(), name: 'Campus', minutes: '0' },
      { key: key(), name: '', minutes: '' },
    ],
  );
  const [trips, setTrips] = useState<TripRow[]>(
    existing?.trips.map((t) => ({
      key: key(),
      direction: t.direction,
      departsAt: t.departsAt,
      days: t.days,
      note: t.note ?? '',
    })) ?? [],
  );
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateStop = (index: number, patch: Partial<StopRow>) =>
    setStops(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const moveStop = (index: number, by: -1 | 1) => {
    const next = [...stops];
    [next[index], next[index + by]] = [next[index + by]!, next[index]!];
    setStops(next);
  };
  const updateTrip = (index: number, patch: Partial<TripRow>) =>
    setTrips(trips.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const submit = () => {
    const parsed = busRouteInputSchema.safeParse({
      name,
      description,
      color,
      active,
      stops: stops.map((s) => ({
        name: s.name,
        minutesFromCampus: s.minutes === '' ? undefined : s.minutes,
      })),
      trips: trips.map((t) => ({
        direction: t.direction,
        departsAt: t.departsAt,
        days: t.days,
        note: t.note,
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length
        ? issue.path[0] === 'stops'
          ? `${text.stopName} ${Number(issue.path[1]) + 1}: `
          : issue.path[0] === 'trips'
            ? `${text.trips} ${Number(issue.path[1]) + 1}: `
            : ''
        : '';
      return setError(`${where}${issue?.message ?? ''}`);
    }
    setError(undefined);
    save.mutate(parsed.data, { onSuccess: () => router.push('/admin/bus') });
  };

  return (
    <>
      <PageHeader
        title={existing ? text.editTitle : text.newTitle}
        description={text.description}
      />
      <form
        noValidate
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="bus-route-name">{text.name}</Label>
            <Input
              id="bus-route-name"
              value={name}
              maxLength={BUS_LIMITS.nameMax}
              placeholder={text.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bus-route-color">{text.color}</Label>
            <div className="flex items-center gap-2">
              <span aria-hidden className={`size-4 shrink-0 rounded-full ${colorClass(color)}`} />
              <select
                id="bus-route-color"
                className={fieldClass}
                value={color}
                onChange={(e) => setColor(e.target.value as BusColor)}
              >
                {BUS_COLORS.map((option) => (
                  <option key={option} value={option}>
                    {help.colors[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bus-route-about">{text.about}</Label>
          <Input
            id="bus-route-about"
            value={description}
            maxLength={BUS_LIMITS.descriptionMax}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {text.active}
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 flex items-center gap-1 text-sm font-medium">
            {text.stops}
            <InfoTip text={text.stopsTip} label={text.stopsTipLabel} />
          </legend>
          {stops.map((stop, index) => (
            <div key={stop.key} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
              <Input
                aria-label={`${text.stopName} ${index + 1}`}
                value={stop.name}
                maxLength={BUS_LIMITS.stopNameMax}
                onChange={(e) => updateStop(index, { name: e.target.value })}
              />
              <Input
                aria-label={`${text.stopMinutes} ${index + 1}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={stop.minutes}
                onChange={(e) => updateStop(index, { minutes: e.target.value })}
              />
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={index === 0}
                  aria-label={`${text.moveUp}: ${stop.name || index + 1}`}
                  onClick={() => moveStop(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={index === stops.length - 1}
                  aria-label={`${text.moveDown}: ${stop.name || index + 1}`}
                  onClick={() => moveStop(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={stops.length <= BUS_LIMITS.stopsMin}
                  aria-label={`${text.removeStop}: ${stop.name || index + 1}`}
                  onClick={() => setStops(stops.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={stops.length >= BUS_LIMITS.stopsMax}
            onClick={() => setStops([...stops, { key: key(), name: '', minutes: '' }])}
          >
            {text.addStop}
          </Button>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-1 flex items-center gap-1 text-sm font-medium">
            {text.trips}
            <InfoTip text={text.tripsTip} label={text.tripsTipLabel} />
          </legend>
          {trips.map((trip, index) => (
            <div key={trip.key} className="grid gap-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
                <div className="grid gap-1">
                  <Label htmlFor={`bus-trip-direction-${trip.key}`}>{text.tripDirection}</Label>
                  <select
                    id={`bus-trip-direction-${trip.key}`}
                    className={fieldClass}
                    value={trip.direction}
                    onChange={(e) =>
                      updateTrip(index, { direction: e.target.value as BusDirection })
                    }
                  >
                    {BUS_DIRECTIONS.map((option) => (
                      <option key={option} value={option}>
                        {help.directions[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`bus-trip-time-${trip.key}`}>{text.tripTime}</Label>
                  <Input
                    id={`bus-trip-time-${trip.key}`}
                    type="time"
                    value={trip.departsAt}
                    onChange={(e) => updateTrip(index, { departsAt: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`bus-trip-note-${trip.key}`}>{text.tripNote}</Label>
                  <Input
                    id={`bus-trip-note-${trip.key}`}
                    value={trip.note}
                    maxLength={BUS_LIMITS.tripNoteMax}
                    onChange={(e) => updateTrip(index, { note: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${text.removeTrip} ${index + 1}`}
                  onClick={() => setTrips(trips.filter((_, i) => i !== index))}
                >
                  {text.removeTrip}
                </Button>
              </div>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">{text.tripDays}</legend>
                {help.dayOrder.map((day) => (
                  <label key={day} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={trip.days.includes(day)}
                      onChange={(e) =>
                        updateTrip(index, {
                          days: e.target.checked
                            ? [...trip.days, day]
                            : trip.days.filter((d) => d !== day),
                        })
                      }
                    />
                    {help.dayShort[day]}
                  </label>
                ))}
              </fieldset>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={trips.length >= BUS_LIMITS.tripsMax}
            onClick={() =>
              setTrips([
                ...trips,
                {
                  key: key(),
                  direction: 'from_campus',
                  departsAt: '',
                  days: [6, 0, 1, 2, 3, 4],
                  note: '',
                },
              ])
            }
          >
            {text.addTrip}
          </Button>
        </fieldset>

        <FormError message={error ?? save.error?.message} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? text.saving : text.save}
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/bus">{text.cancel}</Link>
          </Button>
          {existing ? (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setConfirmDelete(true)}
            >
              {text.deleteRoute}
            </Button>
          ) : null}
        </div>
      </form>
      {confirmDelete && existing ? (
        <ConfirmDialog
          {...text.confirmDelete}
          pending={remove.isPending}
          error={remove.error?.message}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() =>
            remove.mutate(existing.id, { onSuccess: () => router.push('/admin/bus') })
          }
        />
      ) : null}
    </>
  );
}

function Load({ id }: { id: string }) {
  const route = useRoute(id);
  if (route.isPending)
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  if (route.isError)
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.notFound}</p>;
  return <Editor existing={route.data} />;
}

/** /admin/bus/new and /admin/bus/[id] (admins only; the API checks too). */
export function RouteEditor({ id }: { id?: string }) {
  const session = useSession();
  if (session.isPending) return null;
  if (session.user?.role !== 'admin') {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.admin.adminOnly}</p>;
  }
  return id ? <Load id={id} /> : <Editor />;
}
