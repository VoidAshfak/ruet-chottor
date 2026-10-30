import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { CAMPUS_PLACES } from '../common/places.js';
import { MEDIA_PURPOSES, mediaAssetSchema, mediaIdsSchema } from '../media/schemas.js';

export const LOST_FOUND_KINDS = ['lost', 'found'] as const;
export type LostFoundKind = (typeof LOST_FOUND_KINDS)[number];

export const LOST_FOUND_CATEGORIES = [
  'id_card',
  'phone',
  'keys',
  'wallet',
  'bag',
  'book',
  'electronics',
  'clothing',
  'other',
] as const;
export type LostFoundCategory = (typeof LOST_FOUND_CATEGORIES)[number];

/** `open` posts are on the board; `returned` and `closed` are done. */
export const LOST_FOUND_STATES = ['open', 'returned', 'closed'] as const;
export type LostFoundState = (typeof LOST_FOUND_STATES)[number];

export const LOST_FOUND_LIMITS = {
  titleMin: 3,
  titleMax: 100,
  descriptionMax: 2000,
  placeDetailMax: 120,
  questionMax: 200,
  photos: MEDIA_PURPOSES['lost-found.item'].maxPerItem,
  /** Open posts leave the board this long after being posted (or reopened). */
  openDays: 30,
} as const;

const emptyToNull = (value: unknown) => (value === '' ? null : value);
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const lostFoundInputSchema = z
  .object({
    kind: z.enum(LOST_FOUND_KINDS, 'Say whether you lost or found it'),
    category: z.enum(LOST_FOUND_CATEGORIES, 'Pick a category'),
    title: z
      .string()
      .trim()
      .min(LOST_FOUND_LIMITS.titleMin, `At least ${LOST_FOUND_LIMITS.titleMin} characters`)
      .max(LOST_FOUND_LIMITS.titleMax, `At most ${LOST_FOUND_LIMITS.titleMax} characters`),
    description: z
      .string()
      .trim()
      .max(
        LOST_FOUND_LIMITS.descriptionMax,
        `At most ${LOST_FOUND_LIMITS.descriptionMax} characters`,
      ),
    place: z.enum(CAMPUS_PLACES, 'Pick where'),
    placeDetail: z.preprocess(
      emptyToNull,
      z.string().trim().max(LOST_FOUND_LIMITS.placeDetailMax).nullable(),
    ),
    /** The day it was lost or found, "2026-10-26" (Dhaka). */
    happenedOn: z.iso.date('Pick the day'),
    /**
     * Found items only: a question only the real owner can answer ("What is the lock-screen photo?").
     * The answer is never stored; the finder asks it in chat.
     */
    verifyQuestion: z.preprocess(
      emptyToNull,
      z.string().trim().max(LOST_FOUND_LIMITS.questionMax).nullable(),
    ),
    mediaIds: mediaIdsSchema(LOST_FOUND_LIMITS.photos).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'lost' && value.verifyQuestion) {
      ctx.addIssue({
        code: 'custom',
        path: ['verifyQuestion'],
        message: 'Only found items have a check question',
      });
    }
  });
export type LostFoundInput = z.infer<typeof lostFoundInputSchema>;
export type LostFoundInputValues = z.input<typeof lostFoundInputSchema>;

export const lostFoundItemSchema = z.object({
  id: z.string(),
  kind: z.enum(LOST_FOUND_KINDS),
  category: z.enum(LOST_FOUND_CATEGORIES),
  title: z.string(),
  description: z.string(),
  place: z.enum(CAMPUS_PLACES),
  placeDetail: z.string().nullable(),
  happenedOn: z.string(),
  verifyQuestion: z.string().nullable(),
  photos: z.array(mediaAssetSchema),
  poster: z.object({ id: z.string(), name: z.string(), role: z.enum(ROLES) }).nullable(),
  state: z.enum(LOST_FOUND_STATES),
  /** Open posts past their 30 days; they leave the board until reopened. */
  expired: z.boolean(),
  expiresAt: z.string(),
  moderated: z.boolean(),
  /** The poster may edit, mark returned/closed, reopen and delete. */
  isMine: z.boolean(),
  createdAt: z.string(),
});
export type LostFoundItem = z.infer<typeof lostFoundItemSchema>;

export const lostFoundPageSchema = cursorPageSchema(lostFoundItemSchema);
export type LostFoundPage = z.infer<typeof lostFoundPageSchema>;

export const lostFoundBoardQuerySchema = cursorPageQuerySchema.extend({
  kind: z.preprocess(emptyToUndefined, z.enum(LOST_FOUND_KINDS).optional()),
  category: z.preprocess(emptyToUndefined, z.enum(LOST_FOUND_CATEGORIES).optional()),
  place: z.preprocess(emptyToUndefined, z.enum(CAMPUS_PLACES).optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
});
export type LostFoundBoardQuery = z.infer<typeof lostFoundBoardQuerySchema>;

export const lostFoundIdParamSchema = z.object({ id: z.uuid() });

/** POST /lost-found/items/:id/state. `open` reopens a done or expired post for another 30 days. */
export const lostFoundStateRequestSchema = z.object({ state: z.enum(LOST_FOUND_STATES) }).strict();
export type LostFoundStateRequest = z.infer<typeof lostFoundStateRequestSchema>;
