import { z } from 'zod';

export const BUS_DIRECTIONS = ['from_campus', 'to_campus'] as const;
export type BusDirection = (typeof BUS_DIRECTIONS)[number];

/** Route colours; the web app maps each to a theme token. */
export const BUS_COLORS = ['blue', 'orange', 'green', 'red', 'purple', 'teal'] as const;
export type BusColor = (typeof BUS_COLORS)[number];

export const BUS_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  descriptionMax: 300,
  stopsMin: 2,
  stopsMax: 30,
  stopNameMax: 60,
  /** Furthest stop, in minutes from campus. */
  maxMinutes: 240,
  tripsMax: 60,
  tripNoteMax: 80,
  noticeMin: 5,
  noticeMax: 300,
} as const;

/** "16:20" (24-hour, Dhaka time). */
export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 07:30 or 16:20');

/** "16:20" -> 980 */
export function clockToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

/** 980 -> "16:20" */
export function minutesToClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Weekdays as in JavaScript: 0 = Sunday ... 6 = Saturday. */
const weekdaySchema = z.number().int().min(0).max(6);

export const busStopInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the stop').max(BUS_LIMITS.stopNameMax),
    /** Travel time from the campus stop; the campus stop itself is 0. */
    minutesFromCampus: z.coerce.number().int().min(0).max(BUS_LIMITS.maxMinutes),
  })
  .strict();

export const busTripInputSchema = z
  .object({
    direction: z.enum(BUS_DIRECTIONS),
    /** When it leaves its first stop: campus for `from_campus`, the furthest stop for `to_campus`. */
    departsAt: clockTimeSchema,
    days: z
      .array(weekdaySchema)
      .min(1, 'Pick at least one day')
      .refine((days) => new Set(days).size === days.length, 'A day is listed twice'),
    note: z.preprocess(
      (value) => (value === '' ? null : value),
      z.string().trim().max(BUS_LIMITS.tripNoteMax).nullable(),
    ),
  })
  .strict();
export type BusTripInput = z.infer<typeof busTripInputSchema>;

/** POST /bus/routes and PUT /bus/routes/:id: the whole route at once (stops and trips replaced). */
export const busRouteInputSchema = z
  .object({
    name: z.string().trim().min(BUS_LIMITS.nameMin, 'Name the route').max(BUS_LIMITS.nameMax),
    description: z.string().trim().max(BUS_LIMITS.descriptionMax),
    color: z.enum(BUS_COLORS),
    active: z.boolean(),
    stops: z
      .array(busStopInputSchema)
      .min(BUS_LIMITS.stopsMin, `A route needs at least ${BUS_LIMITS.stopsMin} stops`)
      .max(BUS_LIMITS.stopsMax),
    trips: z.array(busTripInputSchema).max(BUS_LIMITS.tripsMax),
  })
  .strict()
  .superRefine((route, ctx) => {
    route.stops.forEach((stop, index) => {
      const previous = route.stops[index - 1];
      if (index === 0 && stop.minutesFromCampus !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['stops', 0, 'minutesFromCampus'],
          message: 'The first stop is campus: 0 minutes',
        });
      }
      if (previous && stop.minutesFromCampus <= previous.minutesFromCampus) {
        ctx.addIssue({
          code: 'custom',
          path: ['stops', index, 'minutesFromCampus'],
          message: 'Each stop must be further from campus than the one before',
        });
      }
    });
  });
export type BusRouteInput = z.infer<typeof busRouteInputSchema>;
export type BusRouteInputValues = z.input<typeof busRouteInputSchema>;

export const busStopSchema = z.object({
  id: z.string(),
  name: z.string(),
  minutesFromCampus: z.number().int(),
});
export type BusStop = z.infer<typeof busStopSchema>;

export const busTripSchema = z.object({
  id: z.string(),
  direction: z.enum(BUS_DIRECTIONS),
  departsAt: z.string(),
  days: z.array(z.number().int()),
  note: z.string().nullable(),
});
export type BusTrip = z.infer<typeof busTripSchema>;

export const busRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.enum(BUS_COLORS),
  active: z.boolean(),
  stops: z.array(busStopSchema),
  trips: z.array(busTripSchema),
  updatedAt: z.string(),
});
export type BusRoute = z.infer<typeof busRouteSchema>;

export const busRouteListSchema = z.object({ items: z.array(busRouteSchema) });
export type BusRouteList = z.infer<typeof busRouteListSchema>;

export const busNoticeInputSchema = z
  .object({
    /** null for all routes. */
    routeId: z.preprocess((value) => (value === '' ? null : value), z.uuid().nullable()),
    message: z
      .string()
      .trim()
      .min(BUS_LIMITS.noticeMin, 'Write the notice')
      .max(BUS_LIMITS.noticeMax),
    startsOn: z.iso.date('Pick the first day'),
    endsOn: z.iso.date('Pick the last day'),
  })
  .strict()
  .refine((notice) => notice.endsOn >= notice.startsOn, {
    message: 'The last day cannot be before the first',
    path: ['endsOn'],
  });
export type BusNoticeInput = z.infer<typeof busNoticeInputSchema>;
export type BusNoticeInputValues = z.input<typeof busNoticeInputSchema>;

export const busNoticeSchema = z.object({
  id: z.string(),
  route: z.object({ id: z.string(), name: z.string(), color: z.enum(BUS_COLORS) }).nullable(),
  message: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
});
export type BusNotice = z.infer<typeof busNoticeSchema>;

export const busNoticeListSchema = z.object({ items: z.array(busNoticeSchema) });
export type BusNoticeList = z.infer<typeof busNoticeListSchema>;

export const busIdParamSchema = z.object({ id: z.uuid() });

/** `?all=true` (admins): inactive routes and past or future notices too. */
export const busListQuerySchema = z.object({
  all: z.preprocess((value) => value === 'true', z.boolean()),
});
export type BusListQuery = z.infer<typeof busListQuerySchema>;

export type Departure = {
  routeId: string;
  routeName: string;
  color: BusColor;
  direction: BusDirection;
  /** Minutes since midnight (Dhaka) when the bus reaches the stop. */
  atMinutes: number;
  note: string | null;
};

/**
 * Departures from a stop (matched by name, so the same place on several routes counts) on one
 * weekday, at or after `fromMinutes`, earliest first. A trip's time at a stop is its departure plus
 * the travel time from its first stop.
 */
export function departuresFrom(
  routes: BusRoute[],
  stopName: string,
  weekday: number,
  fromMinutes: number,
): Departure[] {
  const result: Departure[] = [];
  for (const route of routes) {
    if (!route.active) continue;
    const stop = route.stops.find((s) => s.name === stopName);
    if (!stop) continue;
    const furthest = Math.max(...route.stops.map((s) => s.minutesFromCampus));
    for (const trip of route.trips) {
      if (!trip.days.includes(weekday)) continue;
      const offset =
        trip.direction === 'from_campus'
          ? stop.minutesFromCampus
          : furthest - stop.minutesFromCampus;
      // The last stop of a trip is where it ends, not a departure.
      const isEnd =
        (trip.direction === 'from_campus' && stop.minutesFromCampus === furthest) ||
        (trip.direction === 'to_campus' && stop.minutesFromCampus === 0);
      if (isEnd) continue;
      const atMinutes = clockToMinutes(trip.departsAt) + offset;
      if (atMinutes < fromMinutes || atMinutes >= 24 * 60) continue;
      result.push({
        routeId: route.id,
        routeName: route.name,
        color: route.color,
        direction: trip.direction,
        atMinutes,
        note: trip.note,
      });
    }
  }
  return result.sort((a, b) => a.atMinutes - b.atMinutes);
}
