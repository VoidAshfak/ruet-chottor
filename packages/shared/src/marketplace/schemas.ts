import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { CAMPUS_PLACES } from '../common/places.js';
import { MEDIA_PURPOSES, mediaAssetSchema, mediaIdsSchema } from '../media/schemas.js';

export const LISTING_CATEGORIES = [
  'books',
  'electronics',
  'lab_equipment',
  'furniture',
  'clothing',
  'bicycles',
  'tickets',
  'other',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

/** `available` and `reserved` listings are shown; `sold` ones only to their seller. */
export const LISTING_STATES = ['available', 'reserved', 'sold'] as const;
export type ListingState = (typeof LISTING_STATES)[number];

export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export const MARKETPLACE_LIMITS = {
  titleMin: 3,
  titleMax: 100,
  descriptionMax: 3000,
  meetDetailMax: 120,
  /** Taka; 0 means free. */
  priceMax: 1_000_000,
  photos: MEDIA_PURPOSES['marketplace.listing'].maxPerItem,
  /** Listings leave the marketplace this long after being posted or renewed. */
  openDays: 30,
} as const;

/**
 * Things that may not be sold (shown when posting). A listing mentioning one of `HELD_TERMS` is held
 * for a moderator before anyone sees it.
 */
export const PROHIBITED_ITEMS = [
  'Weapons, knives sold as weapons, explosives',
  'Drugs, alcohol, tobacco and vapes',
  'Exam questions, answers or leaked papers',
  'Assignments, lab reports or theses written for someone else',
  'Fake or borrowed ID cards and documents',
  'Stolen goods or anything illegal',
] as const;

/** Lower-case words and phrases that hold a listing for review (matched as whole words). */
export const HELD_TERMS = [
  'gun',
  'pistol',
  'bullet',
  'explosive',
  'weed',
  'ganja',
  'yaba',
  'phensedyl',
  'drug',
  'drugs',
  'alcohol',
  'beer',
  'whisky',
  'vape',
  'cigarette',
  'question paper',
  'leaked',
  'exam answers',
  'answer sheet',
  'assignment writing',
  'thesis writing',
  'fake id',
] as const;

/** The first held term a text mentions, or null. Whole words only, so "begun" does not match "gun". */
export function heldTermIn(text: string): string | null {
  const lower = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')} `;
  return HELD_TERMS.find((term) => lower.includes(` ${term} `)) ?? null;
}

const emptyToNull = (value: unknown) => (value === '' ? null : value);
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const listingInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(MARKETPLACE_LIMITS.titleMin, `At least ${MARKETPLACE_LIMITS.titleMin} characters`)
      .max(MARKETPLACE_LIMITS.titleMax, `At most ${MARKETPLACE_LIMITS.titleMax} characters`),
    category: z.enum(LISTING_CATEGORIES, 'Pick a category'),
    condition: z.enum(LISTING_CONDITIONS, 'Pick the condition'),
    /** Whole taka; 0 for free. */
    priceTaka: z.coerce
      .number('Enter a price, or 0 if free')
      .int('Whole taka only')
      .min(0, 'The price cannot be negative')
      .max(MARKETPLACE_LIMITS.priceMax, 'That price is too high for this marketplace'),
    description: z
      .string()
      .trim()
      .max(
        MARKETPLACE_LIMITS.descriptionMax,
        `At most ${MARKETPLACE_LIMITS.descriptionMax} characters`,
      ),
    meetPlace: z.enum(CAMPUS_PLACES, 'Pick where to meet'),
    meetDetail: z.preprocess(
      emptyToNull,
      z.string().trim().max(MARKETPLACE_LIMITS.meetDetailMax).nullable(),
    ),
    mediaIds: mediaIdsSchema(MARKETPLACE_LIMITS.photos).default([]),
  })
  .strict();
export type ListingInput = z.infer<typeof listingInputSchema>;
export type ListingInputValues = z.input<typeof listingInputSchema>;

export const listingSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(LISTING_CATEGORIES),
  condition: z.enum(LISTING_CONDITIONS),
  priceTaka: z.number().int(),
  description: z.string(),
  meetPlace: z.enum(CAMPUS_PLACES),
  meetDetail: z.string().nullable(),
  photos: z.array(mediaAssetSchema),
  seller: z.object({ id: z.string(), name: z.string(), role: z.enum(ROLES) }).nullable(),
  state: z.enum(LISTING_STATES),
  expired: z.boolean(),
  expiresAt: z.string(),
  /** Hidden until a moderator checks it (a held term), or hidden/removed after a report. */
  moderated: z.boolean(),
  /** Why it is waiting, for the seller only, e.g. the held term. */
  heldFor: z.string().nullable(),
  isMine: z.boolean(),
  createdAt: z.string(),
});
export type Listing = z.infer<typeof listingSchema>;

export const listingPageSchema = cursorPageSchema(listingSchema);
export type ListingPage = z.infer<typeof listingPageSchema>;

const priceParam = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(0).max(MARKETPLACE_LIMITS.priceMax).optional(),
);

export const listingBrowseQuerySchema = cursorPageQuerySchema
  .extend({
    category: z.preprocess(emptyToUndefined, z.enum(LISTING_CATEGORIES).optional()),
    q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
    minPrice: priceParam,
    maxPrice: priceParam,
    sort: z.preprocess(emptyToUndefined, z.enum(LISTING_SORTS).default('newest')),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'The minimum price is above the maximum',
    path: ['minPrice'],
  });
export type ListingBrowseQuery = z.infer<typeof listingBrowseQuerySchema>;
export type ListingBrowseQueryInput = z.input<typeof listingBrowseQuerySchema>;

export const listingIdParamSchema = z.object({ id: z.uuid() });

export const listingStateRequestSchema = z.object({ state: z.enum(LISTING_STATES) }).strict();
export type ListingStateRequest = z.infer<typeof listingStateRequestSchema>;
