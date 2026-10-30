import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type CursorPageQuery,
  ERROR_CODES,
  NOTIFICATION_LIMITS,
  NotificationEvents,
  type Notification,
  type NotificationPage,
  type NotificationType,
  type UnreadCount,
} from '@ruet-chottor/shared';
import type { Notification as NotificationRow } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsRealtime } from './notifications-realtime.js';

/** What another module asks to send. */
export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Notification not found.' });

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * The inbox. Other modules call `notify()` (exported); members read and mark them over HTTP, and
 * new ones are pushed over the `/notifications` socket after they are saved.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: NotificationsRealtime,
  ) {}

  /**
   * Sends one notification to each recipient. Never throws: a failed notification must not undo
   * the action that caused it (approving a post, cancelling an event).
   */
  async notify(userIds: string[], input: NotifyInput): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;
    try {
      const now = new Date();
      const data = recipients.map((userId) => ({
        userId,
        type: input.type,
        title: clip(input.title, NOTIFICATION_LIMITS.titleMax),
        body: input.body ? clip(input.body, NOTIFICATION_LIMITS.bodyMax) : null,
        link: input.link ?? null,
        createdAt: now,
      }));
      const rows = await this.prisma.notification.createManyAndReturn({ data });
      for (const row of rows) {
        this.realtime.toUser(row.userId, NotificationEvents.New, {
          notification: this.present(row),
        });
      }
      // Housekeeping while we are here: drop these members' old notifications.
      await this.prisma.notification.deleteMany({
        where: {
          userId: { in: recipients },
          createdAt: { lt: new Date(now.getTime() - NOTIFICATION_LIMITS.keepDays * DAY_MS) },
        },
      });
    } catch (error) {
      this.logger.error(`Could not send ${input.type} notifications: ${String(error)}`);
    }
  }

  async list(userId: string, query: CursorPageQuery): Promise<NotificationPage> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => this.present(row)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    // Someone else's notification answers 404, so ids cannot be probed.
    if (!row || row.userId !== userId) throw notFound();
    if (row.readAt) return this.present(row);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    this.realtime.toUser(userId, NotificationEvents.ReadChanged, {});
    return this.present(updated);
  }

  async markAllRead(userId: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count > 0) this.realtime.toUser(userId, NotificationEvents.ReadChanged, {});
  }

  private present(row: NotificationRow): Notification {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
