import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';

export const ACCOUNT_STATUSES = ['active', 'suspended', 'banned'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const MODERATION_ACTIONS = [
  'warn_user',
  'suspend_user',
  'ban_user',
  'reinstate_user',
  'change_role',
  // Content actions (moderation module).
  'hide_content',
  'remove_content',
  'restore_content',
  'dismiss_reports',
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/** Roles that may open the admin panel. Role changes are admin-only. */
export const STAFF_ROLES = ['moderator', 'admin'] as const;

export const ADMIN_LIMITS = {
  suspendMinDays: 1,
  suspendMaxDays: 90,
  reasonMinLength: 5,
  reasonMaxLength: 500,
} as const;

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** Every moderator action needs a reason: it is stored in the log and emailed to the member. */
export const moderationReasonSchema = z
  .string()
  .trim()
  .min(
    ADMIN_LIMITS.reasonMinLength,
    `Reason must be at least ${ADMIN_LIMITS.reasonMinLength} characters`,
  )
  .max(
    ADMIN_LIMITS.reasonMaxLength,
    `Reason must be at most ${ADMIN_LIMITS.reasonMaxLength} characters`,
  );

/** What staff see about a member: no email, phone or date of birth. */
export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  role: z.enum(ROLES),
  status: z.enum(ACCOUNT_STATUSES),
  suspendedUntil: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListQuerySchema = cursorPageQuerySchema.extend({
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  role: z.preprocess(emptyToUndefined, z.enum(ROLES).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(ACCOUNT_STATUSES).optional()),
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserListQueryInput = z.input<typeof adminUserListQuerySchema>;

export const adminUserPageSchema = cursorPageSchema(adminUserSchema);
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

const personRefSchema = z.object({ id: z.string(), name: z.string(), roll: z.string() });

export const moderationLogEntrySchema = z.object({
  id: z.string(),
  action: z.enum(MODERATION_ACTIONS),
  /** null if that account no longer exists. */
  moderator: personRefSchema.nullable(),
  targetUser: personRefSchema.nullable(),
  /** Set for content actions, e.g. "chat.message". */
  contentType: z.string().nullable(),
  contentId: z.string().nullable(),
  reason: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type ModerationLogEntry = z.infer<typeof moderationLogEntrySchema>;

export const moderationLogPageSchema = cursorPageSchema(moderationLogEntrySchema);
export type ModerationLogPage = z.infer<typeof moderationLogPageSchema>;

export const adminUserDetailSchema = z.object({
  user: adminUserSchema,
  history: z.array(moderationLogEntrySchema),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const reasonRequestSchema = z.object({ reason: moderationReasonSchema });
export type ReasonRequest = z.infer<typeof reasonRequestSchema>;

export const suspendRequestSchema = reasonRequestSchema.extend({
  days: z.coerce
    .number()
    .int()
    .min(ADMIN_LIMITS.suspendMinDays, `At least ${ADMIN_LIMITS.suspendMinDays} day`)
    .max(ADMIN_LIMITS.suspendMaxDays, `At most ${ADMIN_LIMITS.suspendMaxDays} days`),
});
export type SuspendRequest = z.infer<typeof suspendRequestSchema>;

export const changeRoleRequestSchema = reasonRequestSchema.extend({ role: z.enum(ROLES) });
export type ChangeRoleRequest = z.infer<typeof changeRoleRequestSchema>;
