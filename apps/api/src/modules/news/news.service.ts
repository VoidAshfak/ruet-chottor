import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  type CursorPageQuery,
  ERROR_CODES,
  type NewsFeedQuery,
  type NewsPage,
  type NewsPost,
  type NewsPostInput,
  NEWS_VERIFIED_ROLES,
  type Role,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { NewsPost as NewsRow, Prisma, User } from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';
import { ClubsService } from '../clubs/clubs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export const NEWS_RATE_LIMITS = {
  // Spam protection (CLAUDE.md §7): a handful of posts an hour is plenty for real news.
  create: { name: 'news:create', limit: 5, windowSeconds: 60 * 60 },
  edit: { name: 'news:edit', limit: 30, windowSeconds: 60 * 60 },
  review: { name: 'news:review', limit: 120, windowSeconds: 15 * 60 },
} as const;

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' });
const forbidden = (message: string) =>
  new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });

/** Verified authors skip review. */
export function publishesDirectly(role: Role): boolean {
  return (NEWS_VERIFIED_ROLES as readonly Role[]).includes(role);
}

/** What normal members see: approved, not moderated, not deleted. */
export const PUBLISHED: Prisma.NewsPostWhereInput = {
  review: 'approved',
  status: 'visible',
  deletedAt: null,
};

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly log: ModerationLogService,
    private readonly rateLimit: RateLimitService,
    /** Present only when the clubs module is switched on. */
    @Optional() private readonly clubs?: ClubsService,
    /** Present only when the notifications module is switched on. */
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async feed(viewerId: string, query: NewsFeedQuery): Promise<NewsPage> {
    return this.page(
      viewerId,
      {
        ...PUBLISHED,
        ...(query.category ? { category: query.category } : {}),
        ...(query.clubId ? { clubId: query.clubId } : {}),
      },
      [{ publishedAt: 'desc' }, { id: 'desc' }],
      query,
    );
  }

  /** The viewer's own posts in every state, newest first. */
  async mine(userId: string, query: CursorPageQuery): Promise<NewsPage> {
    return this.page(
      userId,
      { createdById: userId, deletedAt: null },
      [{ createdAt: 'desc' }, { id: 'desc' }],
      query,
    );
  }

  /** Posts waiting for a moderator, oldest first. */
  async reviewQueue(staffId: string, query: CursorPageQuery): Promise<NewsPage> {
    await this.requireStaff(staffId);
    return this.page(
      staffId,
      { review: 'pending', status: 'visible', deletedAt: null },
      [{ createdAt: 'asc' }, { id: 'asc' }],
      query,
    );
  }

  /** Published posts for everyone; the author and staff also see unpublished ones. */
  async get(viewerId: string, id: string): Promise<NewsPost> {
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post || post.deletedAt) throw notFound();
    const published = post.review === 'approved' && post.status === 'visible';
    if (!published && post.createdById !== viewerId && !(await this.isStaff(viewerId))) {
      throw notFound();
    }
    return this.presentOne(post, viewerId);
  }

  async create(userId: string, input: NewsPostInput): Promise<NewsPost> {
    const author = await this.requireActive(userId);
    await this.rateLimit.consume(NEWS_RATE_LIMITS.create, userId);
    await this.requireClubManager(userId, input.clubId);
    const direct = publishesDirectly(author.role);
    const now = new Date();
    const post = await this.prisma.newsPost.create({
      data: {
        title: input.title,
        category: input.category,
        body: input.body,
        createdById: userId,
        clubId: input.clubId,
        review: direct ? 'approved' : 'pending',
        publishedAt: direct ? now : null,
      },
    });
    await this.media.attach(userId, 'news.post', post.id, input.mediaIds);
    return this.presentOne(post, userId);
  }

  /**
   * The author edits their post. An unverified author's edit goes back to review, so an approved
   * post cannot be swapped for something else.
   */
  async update(userId: string, id: string, input: NewsPostInput): Promise<NewsPost> {
    const author = await this.requireActive(userId);
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post || post.deletedAt) throw notFound();
    if (post.createdById !== userId) throw forbidden('You can only edit your own posts.');
    if (post.status === 'removed') throw forbidden('A moderator removed this post.');
    await this.rateLimit.consume(NEWS_RATE_LIMITS.edit, userId);
    await this.requireClubManager(userId, input.clubId);

    await this.media.attach(userId, 'news.post', post.id, input.mediaIds);
    const direct = publishesDirectly(author.role);
    const updated = await this.prisma.newsPost.update({
      where: { id },
      data: {
        title: input.title,
        category: input.category,
        body: input.body,
        clubId: input.clubId,
        ...(direct
          ? { review: 'approved', publishedAt: post.publishedAt ?? new Date() }
          : { review: 'pending', reviewNote: null }),
      },
    });
    return this.presentOne(updated, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post || post.deletedAt) throw notFound();
    if (post.createdById !== userId) throw forbidden('You can only delete your own posts.');
    await this.prisma.newsPost.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.media.releaseContent('news.post', id);
  }

  async approve(staffId: string, id: string, note?: string): Promise<NewsPost> {
    return this.decide(staffId, id, 'approved', note ?? 'Approved for publishing.');
  }

  async reject(staffId: string, id: string, reason: string): Promise<NewsPost> {
    return this.decide(staffId, id, 'rejected', reason);
  }

  // ----- helpers -----

  private async decide(
    staffId: string,
    id: string,
    review: 'approved' | 'rejected',
    reason: string,
  ): Promise<NewsPost> {
    await this.requireStaff(staffId);
    await this.rateLimit.consume(NEWS_RATE_LIMITS.review, staffId);
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post || post.deletedAt || post.review !== 'pending') throw notFound();
    const now = new Date();
    const [, updated] = await this.prisma.$transaction([
      this.log.record({
        moderatorId: staffId,
        action: review === 'approved' ? 'approve_content' : 'reject_content',
        contentType: 'news.post',
        contentId: id,
        targetUserId: post.createdById,
        reason,
      }),
      this.prisma.newsPost.update({
        where: { id },
        data: {
          review,
          reviewNote: reason,
          reviewedById: staffId,
          reviewedAt: now,
          ...(review === 'approved' && !post.publishedAt ? { publishedAt: now } : {}),
        },
      }),
    ]);
    if (post.createdById !== staffId) {
      await this.notifications?.notify([post.createdById], {
        type: review === 'approved' ? 'news.approved' : 'news.rejected',
        title:
          review === 'approved'
            ? `Your post "${post.title}" is published`
            : `Your post "${post.title}" was not published`,
        body: review === 'approved' ? null : `Moderator's reason: ${reason}`,
        link: `/news/${id}`,
      });
    }
    return this.presentOne(updated, staffId);
  }

  /** Only a club's managers may post for it. */
  private async requireClubManager(userId: string, clubId: string | null) {
    if (!clubId) return;
    if (!this.clubs || !(await this.clubs.isManager(userId, clubId))) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'You can only post for clubs you manage.',
      });
    }
  }

  /** Suspended and banned members cannot post (CLAUDE.md §7). */
  private async requireActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended, so you cannot post news.',
      });
    }
    return user;
  }

  private async isStaff(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return (
      !!user && user.status === 'active' && (STAFF_ROLES as readonly string[]).includes(user.role)
    );
  }

  /** From the database, so a demoted moderator loses access at once. */
  private async requireStaff(userId: string) {
    if (!(await this.isStaff(userId))) {
      throw forbidden('You do not have permission to do this.');
    }
  }

  private async page(
    viewerId: string,
    where: Prisma.NewsPostWhereInput,
    orderBy: Prisma.NewsPostOrderByWithRelationInput[],
    query: CursorPageQuery,
  ): Promise<NewsPage> {
    const rows = await this.prisma.newsPost.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.present(page, viewerId),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private async presentOne(row: NewsRow, viewerId: string): Promise<NewsPost> {
    const [post] = await this.present([row], viewerId);
    return post!;
  }

  private async present(rows: NewsRow[], viewerId: string): Promise<NewsPost[]> {
    if (rows.length === 0) return [];
    const authorIds = [...new Set(rows.map((r) => r.createdById))];
    const clubIds = rows.flatMap((r) => (r.clubId ? [r.clubId] : []));
    const [authors, media, staff, clubs] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, role: true },
      }),
      this.media.forContent(
        'news.post',
        rows.map((r) => r.id),
      ),
      this.isStaff(viewerId),
      this.clubs ? this.clubs.refs(clubIds) : new Map(),
    ]);
    const byId = new Map(authors.map((a) => [a.id, { id: a.id, name: a.name, role: a.role }]));
    return rows.map((row) => {
      const insider = staff || row.createdById === viewerId;
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        body: row.body,
        media: media.get(row.id) ?? [],
        author: byId.get(row.createdById) ?? null,
        club: (row.clubId && clubs.get(row.clubId)) || null,
        review: row.review,
        reviewNote: insider ? row.reviewNote : null,
        moderated: row.status !== 'visible',
        publishedAt: row.publishedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
}
