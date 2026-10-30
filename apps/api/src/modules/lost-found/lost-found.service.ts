import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CursorPageQuery,
  ERROR_CODES,
  LOST_FOUND_LIMITS,
  type LostFoundBoardQuery,
  type LostFoundInput,
  type LostFoundItem,
  type LostFoundPage,
  type LostFoundState,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { LostFoundItem as ItemRow, Prisma, User } from '../../generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const LOST_FOUND_RATE_LIMITS = {
  // Spam protection (CLAUDE.md §7).
  create: { name: 'lost-found:create', limit: 10, windowSeconds: 24 * 60 * 60 },
  edit: { name: 'lost-found:edit', limit: 60, windowSeconds: 60 * 60 },
} as const;

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Post not found.' });

/** When an open post (posted or reopened at `from`) leaves the board. */
export function expiryFrom(from: Date): Date {
  return new Date(from.getTime() + LOST_FOUND_LIMITS.openDays * DAY_MS);
}

@Injectable()
export class LostFoundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** The board: open, not expired, not moderated, newest first. */
  async board(viewerId: string, query: LostFoundBoardQuery): Promise<LostFoundPage> {
    const where: Prisma.LostFoundItemWhereInput = {
      status: 'visible',
      state: 'open',
      expiresAt: { gt: new Date() },
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.place ? { place: query.place } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.page(viewerId, where, query);
  }

  /** The viewer's own posts in every state. */
  async mine(userId: string, query: CursorPageQuery): Promise<LostFoundPage> {
    return this.page(userId, { createdById: userId }, query);
  }

  /** Anyone may open a visible post by link (done ones show their state); posters also moderated ones. */
  async get(viewerId: string, id: string): Promise<LostFoundItem> {
    const item = await this.prisma.lostFoundItem.findUnique({ where: { id } });
    if (!item) throw notFound();
    if (
      item.status !== 'visible' &&
      item.createdById !== viewerId &&
      !(await this.isStaff(viewerId))
    ) {
      throw notFound();
    }
    return this.presentOne(item, viewerId);
  }

  async create(userId: string, input: LostFoundInput): Promise<LostFoundItem> {
    await this.requireActive(userId);
    await this.rateLimit.consume(LOST_FOUND_RATE_LIMITS.create, userId);
    const item = await this.prisma.lostFoundItem.create({
      data: { ...this.fields(input), createdById: userId, expiresAt: expiryFrom(new Date()) },
    });
    await this.media.attach(userId, 'lost-found.item', item.id, input.mediaIds);
    return this.presentOne(item, userId);
  }

  async update(userId: string, id: string, input: LostFoundInput): Promise<LostFoundItem> {
    await this.requireActive(userId);
    const item = await this.owned(userId, id);
    if (item.status === 'removed') throw this.forbidden('A moderator removed this post.');
    await this.rateLimit.consume(LOST_FOUND_RATE_LIMITS.edit, userId);
    await this.media.attach(userId, 'lost-found.item', id, input.mediaIds);
    const updated = await this.prisma.lostFoundItem.update({
      where: { id },
      data: this.fields(input),
    });
    return this.presentOne(updated, userId);
  }

  /** Returned or closed; `open` reopens it for another 30 days. */
  async setState(userId: string, id: string, state: LostFoundState): Promise<LostFoundItem> {
    await this.requireActive(userId);
    await this.owned(userId, id);
    await this.rateLimit.consume(LOST_FOUND_RATE_LIMITS.edit, userId);
    const updated = await this.prisma.lostFoundItem.update({
      where: { id },
      data: { state, ...(state === 'open' ? { expiresAt: expiryFrom(new Date()) } : {}) },
    });
    return this.presentOne(updated, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.media.releaseContent('lost-found.item', id);
    await this.prisma.lostFoundItem.delete({ where: { id } });
  }

  // ----- helpers -----

  private fields(input: LostFoundInput) {
    return {
      kind: input.kind,
      category: input.category,
      title: input.title,
      description: input.description,
      place: input.place,
      placeDetail: input.placeDetail,
      happenedOn: new Date(`${input.happenedOn}T00:00:00Z`),
      verifyQuestion: input.kind === 'found' ? input.verifyQuestion : null,
    };
  }

  private forbidden(message: string) {
    return new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
  }

  /** Someone else's post looks the same as a missing one for changes. */
  private async owned(userId: string, id: string): Promise<ItemRow> {
    const item = await this.prisma.lostFoundItem.findUnique({ where: { id } });
    if (!item) throw notFound();
    if (item.createdById !== userId) throw this.forbidden('You can only change your own posts.');
    return item;
  }

  private async isStaff(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return (
      !!user && user.status === 'active' && (STAFF_ROLES as readonly string[]).includes(user.role)
    );
  }

  /** Suspended and banned members cannot post (CLAUDE.md §7). */
  private async requireActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended, so you cannot post.',
      });
    }
    return user;
  }

  private async page(
    viewerId: string,
    where: Prisma.LostFoundItemWhereInput,
    query: CursorPageQuery,
  ): Promise<LostFoundPage> {
    const rows = await this.prisma.lostFoundItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  private async presentOne(row: ItemRow, viewerId: string): Promise<LostFoundItem> {
    const [item] = await this.present([row], viewerId);
    return item!;
  }

  private async present(rows: ItemRow[], viewerId: string): Promise<LostFoundItem[]> {
    if (rows.length === 0) return [];
    const [posters, photos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
        select: { id: true, name: true, role: true },
      }),
      this.media.forContent(
        'lost-found.item',
        rows.map((r) => r.id),
      ),
    ]);
    const byId = new Map(posters.map((p) => [p.id, p]));
    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      category: row.category,
      title: row.title,
      description: row.description,
      place: row.place,
      placeDetail: row.placeDetail,
      happenedOn: row.happenedOn.toISOString().slice(0, 10),
      verifyQuestion: row.verifyQuestion,
      photos: photos.get(row.id) ?? [],
      poster: byId.get(row.createdById) ?? null,
      state: row.state,
      expired: row.state === 'open' && row.expiresAt.getTime() <= now,
      expiresAt: row.expiresAt.toISOString(),
      moderated: row.status !== 'visible',
      isMine: row.createdById === viewerId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
