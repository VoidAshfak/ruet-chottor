import { z } from 'zod';
import { ROLES, type Role } from '../auth/schemas.js';
import { clubRefSchema } from '../clubs/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { MEDIA_PURPOSES, mediaAssetSchema, mediaIdsSchema } from '../media/schemas.js';

export const NEWS_CATEGORIES = ['announcement', 'academic', 'event', 'club', 'general'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_REVIEW_STATES = ['pending', 'approved', 'rejected'] as const;
export type NewsReviewState = (typeof NEWS_REVIEW_STATES)[number];

/** These roles publish straight away; everyone else's posts wait for a moderator (CLAUDE.md §7). */
export const NEWS_VERIFIED_ROLES = ['moderator', 'admin', 'club_manager'] as const satisfies Role[];

export const NEWS_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 5000,
  media: MEDIA_PURPOSES['news.post'].maxPerItem,
  /** Characters of the body shown on a feed card. */
  excerpt: 280,
} as const;

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const newsPostInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(NEWS_LIMITS.titleMin, `Titles need at least ${NEWS_LIMITS.titleMin} characters`)
      .max(NEWS_LIMITS.titleMax, `Titles are at most ${NEWS_LIMITS.titleMax} characters`),
    category: z.enum(NEWS_CATEGORIES, 'Pick a category'),
    body: z
      .string()
      .trim()
      .min(NEWS_LIMITS.bodyMin, `Write at least ${NEWS_LIMITS.bodyMin} characters`)
      .max(NEWS_LIMITS.bodyMax, `Posts are at most ${NEWS_LIMITS.bodyMax} characters`),
    mediaIds: mediaIdsSchema(NEWS_LIMITS.media).default([]),
    /** Post as this club; only its managers may. */
    clubId: z
      .preprocess((value) => (value === '' ? null : value), z.uuid().nullable())
      .default(null),
  })
  .strict();
export type NewsPostInput = z.infer<typeof newsPostInputSchema>;
export type NewsPostInputValues = z.input<typeof newsPostInputSchema>;

export const newsAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
});

export const newsPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(NEWS_CATEGORIES),
  body: z.string(),
  media: z.array(mediaAssetSchema),
  /** null if the author's account no longer exists. */
  author: newsAuthorSchema.nullable(),
  /** The club it was posted for, if any (and if clubs are switched on). */
  club: clubRefSchema.nullable(),
  review: z.enum(NEWS_REVIEW_STATES),
  /** The moderator's reason; only sent to the author and staff. */
  reviewNote: z.string().nullable(),
  /** Hidden or removed by a moderator after a report; only the author and staff still get it. */
  moderated: z.boolean(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NewsPost = z.infer<typeof newsPostSchema>;

export const newsPageSchema = cursorPageSchema(newsPostSchema);
export type NewsPage = z.infer<typeof newsPageSchema>;

export const newsFeedQuerySchema = cursorPageQuerySchema.extend({
  category: z.preprocess(emptyToUndefined, z.enum(NEWS_CATEGORIES).optional()),
  clubId: z.preprocess(emptyToUndefined, z.uuid().optional()),
});
export type NewsFeedQuery = z.infer<typeof newsFeedQuerySchema>;
export type NewsFeedQueryInput = z.input<typeof newsFeedQuerySchema>;

export const newsIdParamSchema = z.object({ id: z.uuid() });

/** Approving may carry a note for the log; rejecting must say why (the author sees it). */
export const newsApproveRequestSchema = z
  .object({ note: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()) })
  .strict();
export type NewsApproveRequest = z.infer<typeof newsApproveRequestSchema>;
