import { z } from 'zod';
import { cursorPageSchema } from '../common/pagination.js';

/**
 * What a notification is about, `<module>.<event>`. Other modules send them through the API's
 * `NotificationsService`; the web app picks an icon from the part before the dot.
 */
export const NOTIFICATION_TYPES = [
  'clubs.join_requested',
  'clubs.join_approved',
  'clubs.manager_appointed',
  'news.approved',
  'news.rejected',
  'events.changed',
  'events.cancelled',
  'events.approved',
  'events.rejected',
  'moderation.hidden',
  'moderation.removed',
  'moderation.restored',
  'users.class_rep_approved',
  'users.class_rep_rejected',
  'users.class_rep_revoked',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LIMITS = {
  titleMax: 120,
  bodyMax: 300,
  /** Older notifications are deleted. */
  keepDays: 90,
} as const;

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string(),
  body: z.string().nullable(),
  /** A path inside the web app, e.g. `/events/<id>`. */
  link: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationPageSchema = cursorPageSchema(notificationSchema);
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export const unreadCountSchema = z.object({ count: z.number().int().min(0) });
export type UnreadCount = z.infer<typeof unreadCountSchema>;

export const notificationIdParamSchema = z.object({ id: z.uuid() });

/** server -> client on the `/notifications` namespace. */
export const notificationNewEventSchema = z.object({ notification: notificationSchema });
export type NotificationNewEvent = z.infer<typeof notificationNewEventSchema>;
