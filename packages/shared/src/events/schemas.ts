import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { clubRefSchema } from '../clubs/schemas.js';
import { cursorPageSchema } from '../common/pagination.js';
import { mediaAssetSchema } from '../media/schemas.js';
import { CLASS_SECTIONS, departmentSummarySchema } from '../users/schemas.js';

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

/**
 * Class events by verified class representatives wait for a moderator (`pending`); every other
 * event is `approved` at once. A CR's edit sends the event back to `pending`.
 */
export const EVENT_REVIEWS = ['pending', 'approved', 'rejected'] as const;
export type EventReview = (typeof EVENT_REVIEWS)[number];

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
    /** A class event by a verified class representative (needs clubId null); waits for review. */
    forClass: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.forClass && value.clubId) {
      ctx.addIssue({
        code: 'custom',
        path: ['clubId'],
        message: 'A class event cannot also be a club event',
      });
    }
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

/** The class a CR event is for, fixed when it was created. */
export const eventClassSchema = z.object({
  department: departmentSummarySchema.nullable(),
  series: z.number().int(),
  section: z.enum(CLASS_SECTIONS).nullable(),
});
export type EventClass = z.infer<typeof eventClassSchema>;

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
  /** Set for class events by a class representative. */
  class: eventClassSchema.nullable().default(null),
  organiser: z.object({ id: z.string(), name: z.string(), role: z.enum(ROLES) }).nullable(),
  poster: mediaAssetSchema.nullable(),
  capacity: z.number().int().nullable(),
  goingCount: z.number().int(),
  isGoing: z.boolean(),
  isFull: z.boolean(),
  cancelled: z.boolean(),
  /** Hidden or removed by a moderator; only its organisers and staff still get it. */
  moderated: z.boolean(),
  /** The organiser, the club's managers and staff may cancel and see attendees. */
  canEdit: z.boolean(),
  /**
   * May open the edit form: like `canEdit`, except that a class event's organiser must still be a
   * verified CR.
   */
  canEditDetails: z.boolean(),
  review: z.enum(EVENT_REVIEWS).default('approved'),
  /** The moderator's reason on rejection; only for the organisers and staff. */
  reviewNote: z.string().nullable().default(null),
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

/** GET /events/review: class events waiting for a moderator, oldest first. */
export const eventReviewPageSchema = cursorPageSchema(eventSchema);
export type EventReviewPage = z.infer<typeof eventReviewPageSchema>;

export const eventAttendeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  since: z.string(),
});
export const eventAttendeesSchema = z.object({ items: z.array(eventAttendeeSchema) });
export type EventAttendees = z.infer<typeof eventAttendeesSchema>;
