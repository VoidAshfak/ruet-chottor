import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type ContentAction,
  type CreateReportRequest,
  ERROR_CODES,
  type ModeratableContentType,
  type ModerationAction,
  type ModerationItemDetail,
  type ModerationQueueItem,
  type ModerationQueuePage,
  type ModerationQueueQuery,
  type MyReportsQuery,
  type MyReportsResponse,
  REPORT_REASONS,
  type ReportReason,
  STAFF_ROLES,
  SYSTEM_MODERATOR_ID,
} from '@ruet-chottor/shared';
import type { Env } from '../../core/config/env.js';
import {
  type ModeratableContent,
  ModeratableContentRegistry,
  type ModeratableItem,
} from '../../core/moderation/moderatable-content.registry.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import { Prisma, type Report } from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';

export const MODERATION_RATE_LIMITS = {
  report: { name: 'moderation:report', limit: 20, windowSeconds: 60 * 60 },
  actions: { name: 'moderation:actions', limit: 120, windowSeconds: 15 * 60 },
} as const;

const LOG_ACTION: Record<ContentAction, ModerationAction> = {
  hide: 'hide_content',
  remove: 'remove_content',
  restore: 'restore_content',
  dismiss: 'dismiss_reports',
};

const notFound = (message = 'Not found.') =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
const conflict = (message: string) =>
  new ConflictException({ code: ERROR_CODES.CONFLICT, message });

type Group = { contentType: ModeratableContentType; contentId: string; reports: Report[] };

/** Groups reports by item. Open queue: most-reported first, then the longest waiting. */
export function groupReports(reports: Report[], status: Report['status']): Group[] {
  const groups = new Map<string, Group>();
  for (const report of reports) {
    const key = `${report.contentType}:${report.contentId}`;
    const group = groups.get(key) ?? {
      contentType: report.contentType as ModeratableContentType,
      contentId: report.contentId,
      reports: [],
    };
    group.reports.push(report);
    groups.set(key, group);
  }
  const first = (g: Group) => Math.min(...g.reports.map((r) => r.createdAt.getTime()));
  const last = (g: Group) => Math.max(...g.reports.map((r) => r.createdAt.getTime()));
  return [...groups.values()].sort((a, b) =>
    status === 'open'
      ? b.reports.length - a.reports.length || first(a) - first(b)
      : last(b) - last(a),
  );
}

@Injectable()
export class ModerationService {
  private readonly autoHideAt: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModeratableContentRegistry,
    private readonly log: ModerationLogService,
    private readonly rateLimit: RateLimitService,
    config: ConfigService<Env, true>,
  ) {
    this.autoHideAt = config.get('MODERATION_AUTO_HIDE_REPORTS', { infer: true });
  }

  // ----- members -----

  /** Files a report. Hides the item automatically once enough different people reported it. */
  async report(userId: string, input: CreateReportRequest): Promise<void> {
    const provider = this.provider(input.contentType);
    await this.rateLimit.consume(MODERATION_RATE_LIMITS.report, userId);
    // Same answer for "does not exist" and "you cannot see it", so reports cannot probe content.
    if (!(await provider.canReport(userId, input.contentId))) throw notFound();
    const item = await provider.load(input.contentId);
    if (!item) throw notFound();
    if (item.authorId === userId) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'You cannot report your own content.',
      });
    }

    try {
      await this.prisma.report.create({
        data: {
          contentType: input.contentType,
          contentId: input.contentId,
          reporterId: userId,
          reason: input.reason,
          note: input.note ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('You already reported this.');
      }
      throw error;
    }

    const open = await this.prisma.report.count({
      where: { contentType: input.contentType, contentId: input.contentId, status: 'open' },
    });
    if (open >= this.autoHideAt && item.status === 'visible') {
      await provider.setStatus(input.contentId, 'hidden');
      // The reports stay open: a moderator still decides (dismissing restores the item).
      await this.log.record({
        moderatorId: SYSTEM_MODERATOR_ID,
        action: 'hide_content',
        contentType: input.contentType,
        contentId: input.contentId,
        targetUserId: item.authorId,
        reason: `Hidden automatically after ${open} reports.`,
        details: { auto: true, reports: open },
      });
    }
  }

  /**
   * For content modules: put an item in front of moderators without a member's report, e.g. a
   * marketplace listing that mentions a prohibited item. The report comes from the system account;
   * the item should already be hidden. Restoring it (or dismissing the report) publishes it.
   */
  async holdForReview(
    contentType: ModeratableContentType,
    contentId: string,
    note: string,
  ): Promise<void> {
    await this.prisma.report.upsert({
      where: {
        contentType_contentId_reporterId: {
          contentType,
          contentId,
          reporterId: SYSTEM_MODERATOR_ID,
        },
      },
      create: { contentType, contentId, reporterId: SYSTEM_MODERATOR_ID, reason: 'other', note },
      update: { status: 'open', note, resolvedById: null, resolvedAt: null },
    });
  }

  async mine(userId: string, query: MyReportsQuery): Promise<MyReportsResponse> {
    const reports = await this.prisma.report.findMany({
      where: { reporterId: userId, contentType: query.contentType, contentId: { in: query.ids } },
    });
    return { reportedIds: reports.map((r) => r.contentId) };
  }

  // ----- staff -----

  async queue(staffId: string, query: ModerationQueueQuery): Promise<ModerationQueuePage> {
    await this.requireStaff(staffId);
    const reports = await this.prisma.report.findMany({
      where: {
        status: query.status,
        ...(query.contentType ? { contentType: query.contentType } : {}),
      },
    });
    const groups = groupReports(reports, query.status);
    // The cursor is an offset into the sorted queue.
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const page = groups.slice(offset, offset + query.limit);
    const next = offset + query.limit;
    return {
      items: await Promise.all(page.map((group) => this.presentGroup(group))),
      nextCursor: next < groups.length ? String(next) : null,
    };
  }

  async item(
    staffId: string,
    contentType: ModeratableContentType,
    contentId: string,
  ): Promise<ModerationItemDetail> {
    await this.requireStaff(staffId);
    return this.detail(contentType, contentId);
  }

  async act(
    staffId: string,
    contentType: ModeratableContentType,
    contentId: string,
    action: ContentAction,
    reason: string,
  ): Promise<ModerationItemDetail> {
    await this.requireStaff(staffId);
    await this.rateLimit.consume(MODERATION_RATE_LIMITS.actions, staffId);
    const provider = this.registry.get(contentType);
    const item = (await provider?.load(contentId)) ?? null;
    if (!item && action !== 'dismiss') throw notFound('This item no longer exists.');
    const where = { contentType, contentId, status: 'open' as const };
    const openCount = await this.prisma.report.count({ where });

    if (action === 'hide' && item?.status !== 'visible') {
      throw conflict('It is already hidden or removed.');
    }
    if (action === 'remove' && item?.status === 'removed') throw conflict('It is already removed.');
    if (action === 'restore' && item?.status === 'visible')
      throw conflict('It is already visible.');
    if (action === 'dismiss' && openCount === 0) throw conflict('There are no open reports.');

    if (provider && item) {
      if (action === 'hide') await provider.setStatus(contentId, 'hidden');
      if (action === 'remove') await provider.setStatus(contentId, 'removed');
      if (action === 'restore') await provider.setStatus(contentId, 'visible');
      // Dismissing the reports of an automatically hidden item puts it back.
      if (action === 'dismiss' && item.status === 'hidden') {
        await provider.setStatus(contentId, 'visible');
      }
    }

    const now = new Date();
    // Restoring says the item is fine, so any reports still open (e.g. an automatic hold) close too.
    const resolve: Record<ContentAction, 'actioned' | 'dismissed'> = {
      hide: 'actioned',
      remove: 'actioned',
      restore: 'dismissed',
      dismiss: 'dismissed',
    };
    const status = resolve[action];
    await this.prisma.$transaction([
      this.log.record({
        moderatorId: staffId,
        action: LOG_ACTION[action],
        contentType,
        contentId,
        ...(item ? { targetUserId: item.authorId } : {}),
        reason,
        details: { reports: openCount },
      }),
      ...(status
        ? [
            this.prisma.report.updateMany({
              where,
              data: { status, resolvedById: staffId, resolvedAt: now },
            }),
          ]
        : []),
    ]);
    return this.detail(contentType, contentId);
  }

  // ----- helpers -----

  private provider(type: ModeratableContentType): ModeratableContent {
    const provider = this.registry.get(type);
    if (!provider) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'This kind of content cannot be reported right now.',
      });
    }
    return provider;
  }

  /** The role in the database, not only the access token: a demoted moderator loses access at once. */
  private async requireStaff(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.status !== 'active' ||
      !(STAFF_ROLES as readonly string[]).includes(user.role)
    ) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to do this.',
      });
    }
  }

  private async detail(
    contentType: ModeratableContentType,
    contentId: string,
  ): Promise<ModerationItemDetail> {
    const reports = await this.prisma.report.findMany({
      where: { contentType, contentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const item = await this.registry.get(contentType)?.load(contentId);
    if (reports.length === 0 && !item) throw notFound();

    const reporters = await this.people(reports.map((r) => r.reporterId));
    const history = await this.log.forContent(contentType, contentId);
    return {
      item: await this.presentGroup({ contentType, contentId, reports }, item ?? null),
      reports: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        reporter: reporters.get(r.reporterId) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      history,
    };
  }

  private async presentGroup(
    group: Group,
    loaded?: ModeratableItem | null,
  ): Promise<ModerationQueueItem> {
    const provider = this.registry.get(group.contentType);
    const item = loaded !== undefined ? loaded : ((await provider?.load(group.contentId)) ?? null);
    const author = item ? (await this.people([item.authorId])).get(item.authorId) : undefined;
    const times = group.reports.map((r) => r.createdAt.getTime());
    const counts = new Map<ReportReason, number>();
    for (const report of group.reports) {
      counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
    }
    const now = Date.now();
    return {
      contentType: group.contentType,
      contentId: group.contentId,
      label: provider?.label ?? group.contentType,
      context: item?.context ?? null,
      preview: item?.preview ?? null,
      contentStatus: item?.status ?? null,
      author: author ?? null,
      reportCount: group.reports.length,
      reasons: REPORT_REASONS.filter((reason) => counts.has(reason)).map((reason) => ({
        reason,
        count: counts.get(reason)!,
      })),
      firstReportedAt: new Date(times.length ? Math.min(...times) : now).toISOString(),
      lastReportedAt: new Date(times.length ? Math.max(...times) : now).toISOString(),
    };
  }

  private async people(ids: string[]) {
    if (ids.length === 0) return new Map<string, { id: string; name: string; roll: string }>();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, roll: true },
    });
    return new Map(rows.map((u) => [u.id, { id: u.id, name: u.name, roll: u.roll }]));
  }
}
