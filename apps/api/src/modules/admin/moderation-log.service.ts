import { Injectable } from '@nestjs/common';
import type { ModerationAction, ModerationLogEntry, ModerationLogPage } from '@ruet-chottor/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { ModerationLog, Prisma } from '../../generated/prisma/client.js';

export type NewLogEntry = {
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  targetUserId?: string;
  contentType?: string;
  contentId?: string;
  details?: Prisma.InputJsonObject;
};

/**
 * The append-only moderation audit trail (CLAUDE.md §7). Exported so every module that lets
 * staff act on content records its actions here. There is deliberately no update or delete.
 */
@Injectable()
export class ModerationLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the Prisma operation so callers can put it in the same transaction as the action. */
  record(entry: NewLogEntry) {
    return this.prisma.moderationLog.create({ data: entry });
  }

  async list(options: { cursor?: string; take: number }): Promise<ModerationLogPage> {
    const rows = await this.prisma.moderationLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > options.take;
    const page = hasMore ? rows.slice(0, options.take) : rows;
    return {
      items: await this.withPeople(page),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** The newest actions taken against one member. */
  async forUser(userId: string, take = 50): Promise<ModerationLogEntry[]> {
    const rows = await this.prisma.moderationLog.findMany({
      where: { targetUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
    return this.withPeople(rows);
  }

  /** Every action taken on one content item, newest first. */
  async forContent(
    contentType: string,
    contentId: string,
    take = 50,
  ): Promise<ModerationLogEntry[]> {
    const rows = await this.prisma.moderationLog.findMany({
      where: { contentType, contentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
    return this.withPeople(rows);
  }

  private async withPeople(rows: ModerationLog[]): Promise<ModerationLogEntry[]> {
    const ids = [
      ...new Set(rows.flatMap((row) => [row.moderatorId, row.targetUserId ?? []]).flat()),
    ];
    const people = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, roll: true },
    });
    const byId = new Map(people.map((person) => [person.id, person]));
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      moderator: byId.get(row.moderatorId) ?? null,
      targetUser: row.targetUserId ? (byId.get(row.targetUserId) ?? null) : null,
      contentType: row.contentType,
      contentId: row.contentId,
      reason: row.reason,
      details: (row.details as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
