import { z } from 'zod';
import { moderationLogEntrySchema, moderationReasonSchema } from '../admin/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';

/**
 * Content types that can be reported. A content module adds its key here and registers a
 * ModeratableContent provider in the API (see the add-moderation skill).
 */
export const MODERATABLE_CONTENT_TYPES = ['chat.message'] as const;
export type ModeratableContentType = (typeof MODERATABLE_CONTENT_TYPES)[number];

/** Visibility of user-generated content (CLAUDE.md §7). */
export const CONTENT_STATUSES = ['visible', 'hidden', 'removed'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'violence',
  'misinformation',
  'inappropriate',
  'scam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONTENT_ACTIONS = ['hide', 'remove', 'restore', 'dismiss'] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

/**
 * `moderatorId` of log entries the system makes by itself (auto-hiding a much-reported item).
 * Their `details.auto` is true.
 */
export const SYSTEM_MODERATOR_ID = '00000000-0000-0000-0000-000000000000';

export const MODERATION_LIMITS = {
  noteMaxLength: 500,
  /** Checking "did I report these?" for at most this many items at once. */
  myReportsMaxIds: 100,
} as const;

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const createReportRequestSchema = z
  .object({
    contentType: z.enum(MODERATABLE_CONTENT_TYPES),
    contentId: z.uuid(),
    reason: z.enum(REPORT_REASONS, 'Pick a reason'),
    note: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(
          MODERATION_LIMITS.noteMaxLength,
          `Notes are at most ${MODERATION_LIMITS.noteMaxLength} characters`,
        )
        .optional(),
    ),
  })
  .strict();
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;
export type CreateReportRequestInput = z.input<typeof createReportRequestSchema>;

/** GET /moderation/reports/mine?contentType=&ids=a,b,c */
export const myReportsQuerySchema = z.object({
  contentType: z.enum(MODERATABLE_CONTENT_TYPES),
  ids: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.uuid()).min(1).max(MODERATION_LIMITS.myReportsMaxIds)),
});
export type MyReportsQuery = z.infer<typeof myReportsQuerySchema>;

/** The ids (from the request) that the viewer has already reported. */
export const myReportsResponseSchema = z.object({ reportedIds: z.array(z.string()) });
export type MyReportsResponse = z.infer<typeof myReportsResponseSchema>;

const personRefSchema = z.object({ id: z.string(), name: z.string(), roll: z.string() });

export const reasonCountSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  count: z.number().int(),
});

/** One reported item in the queue. Staff see only the reported item, never the rest of a chat. */
export const moderationQueueItemSchema = z.object({
  contentType: z.enum(MODERATABLE_CONTENT_TYPES),
  contentId: z.string(),
  /** e.g. "Chat message". */
  label: z.string(),
  /** e.g. "Group chat"; null when the item no longer exists. */
  context: z.string().nullable(),
  /** The reported text; null when the item no longer exists. */
  preview: z.string().nullable(),
  contentStatus: z.enum(CONTENT_STATUSES).nullable(),
  author: personRefSchema.nullable(),
  reportCount: z.number().int(),
  reasons: z.array(reasonCountSchema),
  firstReportedAt: z.string(),
  lastReportedAt: z.string(),
});
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;

export const moderationQueueQuerySchema = cursorPageQuerySchema.extend({
  contentType: z.preprocess(emptyToUndefined, z.enum(MODERATABLE_CONTENT_TYPES).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(REPORT_STATUSES).default('open')),
});
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;
export type ModerationQueueQueryInput = z.input<typeof moderationQueueQuerySchema>;

export const moderationQueuePageSchema = cursorPageSchema(moderationQueueItemSchema);
export type ModerationQueuePage = z.infer<typeof moderationQueuePageSchema>;

export const reportSchema = z.object({
  id: z.string(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().nullable(),
  status: z.enum(REPORT_STATUSES),
  /** Visible to staff only, so false reports can be followed up. */
  reporter: personRefSchema.nullable(),
  createdAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

export const moderationItemDetailSchema = z.object({
  item: moderationQueueItemSchema,
  reports: z.array(reportSchema),
  history: z.array(moderationLogEntrySchema),
});
export type ModerationItemDetail = z.infer<typeof moderationItemDetailSchema>;

export const contentItemParamsSchema = z.object({
  contentType: z.enum(MODERATABLE_CONTENT_TYPES),
  contentId: z.uuid(),
});
export type ContentItemParams = z.infer<typeof contentItemParamsSchema>;

export const contentActionParamsSchema = contentItemParamsSchema.extend({
  action: z.enum(CONTENT_ACTIONS),
});
export type ContentActionParams = z.infer<typeof contentActionParamsSchema>;

export const contentActionRequestSchema = z.object({ reason: moderationReasonSchema }).strict();
export type ContentActionRequest = z.infer<typeof contentActionRequestSchema>;
