import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { clubRefSchema } from '../clubs/schemas.js';
import { mediaAssetSchema } from '../media/schemas.js';

export const EVENT_CATEGORIES = [
  'workshop',
  'competition',
  'seminar',
  'cultural',
  'sports',
  'meeting',
  'other',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export const EVENT_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMax: 5000,
  venueMin: 2,
  venueMax: 120,
  capacityMax: 10000,
  /** Longest event, e.g. a week-long fest. */
  maxDurationDays: 14,
  /** Widest range one calendar request may ask for. */
  maxRangeDays: 62,
} as const;

const emptyToNull = (value: unknown) => (value === '' ? null : value);
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** POST /events and PATCH /events/:id. Times are ISO instants (the web form sends Dhaka time). */
export const eventInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(EVENT_LIMITS.titleMin, `Titles need at least ${EVENT_LIMITS.titleMin} characters`)
      .max(EVENT_LIMITS.titleMax, `Titles are at most ${EVENT_LIMITS.titleMax} characters`),
    category: z.enum(EVENT_CATEGORIES, 'Pick a category'),
    description: z
      .string()
      .trim()
      .max(EVENT_LIMITS.descriptionMax, `At most ${EVENT_LIMITS.descriptionMax} characters`),
    venue: z
      .string()
      .trim()
      .min(EVENT_LIMITS.venueMin, 'Say where it happens')
      .max(EVENT_LIMITS.venueMax, `At most ${EVENT_LIMITS.venueMax} characters`),
    startsAt: z.iso.datetime({ offset: true, message: 'Pick a start time' }),
    endsAt: z.iso.datetime({ offset: true, message: 'Pick an end time' }),
    /** The club organising it; null for campus-wide events (staff only). */
    clubId: z.preprocess(emptyToNull, z.uuid().nullable()),
    /** Most people who can say "Going"; null for no limit. */
    capacity: z.preprocess(
      emptyToNull,
      z.coerce
        .number()
        .int()
        .min(1, 'At least 1')
        .max(EVENT_LIMITS.capacityMax, `At most ${EVENT_LIMITS.capacityMax}`)
        .nullable(),
    ),
    /** A checked upload (purpose "events.poster"), or null. */
    posterId: z.preprocess(emptyToNull, z.uuid().nullable()),
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    if (end <= start) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'It must end after it starts' });
    } else if (end - start > EVENT_LIMITS.maxDurationDays * DAY_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: `Events last at most ${EVENT_LIMITS.maxDurationDays} days`,
      });
    }
  });
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventInputValues = z.input<typeof eventInputSchema>;

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  description: z.string(),
  venue: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  /** null for campus-wide events, or when clubs are switched off. */
  club: clubRefSchema.nullable(),
  organiser: z.object({ id: z.string(), name: z.string(), role: z.enum(ROLES) }).nullable(),
  poster: mediaAssetSchema.nullable(),
  capacity: z.number().int().nullable(),
  goingCount: z.number().int(),
  isGoing: z.boolean(),
  isFull: z.boolean(),
  cancelled: z.boolean(),
  /** Hidden or removed by a moderator; only its organisers and staff still get it. */
  moderated: z.boolean(),
  /** The organiser, the club's managers and staff may edit, cancel and see attendees. */
  canEdit: z.boolean(),
});
export type CampusEvent = z.infer<typeof eventSchema>;

/** GET /events?from=&to=: everything overlapping the range (a calendar month, or "upcoming"). */
export const eventRangeQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
    clubId: z.preprocess(emptyToUndefined, z.uuid().optional()),
    category: z.preprocess(emptyToUndefined, z.enum(EVENT_CATEGORIES).optional()),
  })
  .refine(
    (q) => {
      const span = Date.parse(q.to) - Date.parse(q.from);
      return span > 0 && span <= EVENT_LIMITS.maxRangeDays * DAY_MS;
    },
    { message: `Ask for at most ${EVENT_LIMITS.maxRangeDays} days at a time`, path: ['to'] },
  );
export type EventRangeQuery = z.infer<typeof eventRangeQuerySchema>;

export const eventListSchema = z.object({ items: z.array(eventSchema) });
export type EventList = z.infer<typeof eventListSchema>;

export const eventIdParamSchema = z.object({ id: z.uuid() });

export const eventAttendeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  since: z.string(),
});
export const eventAttendeesSchema = z.object({ items: z.array(eventAttendeeSchema) });
export type EventAttendees = z.infer<typeof eventAttendeesSchema>;
