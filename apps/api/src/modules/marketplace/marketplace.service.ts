import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  type CursorPageQuery,
  ERROR_CODES,
  heldTermIn,
  type Listing,
  type ListingBrowseQuery,
  type ListingInput,
  type ListingPage,
  type ListingState,
  MARKETPLACE_LIMITS,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { Listing as ListingRow, Prisma, User } from '../../generated/prisma/client.js';
import { ModerationService } from '../moderation/moderation.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const MARKETPLACE_RATE_LIMITS = {
  // Spam protection (CLAUDE.md §7).
  create: { name: 'marketplace:create', limit: 10, windowSeconds: 24 * 60 * 60 },
  edit: { name: 'marketplace:edit', limit: 60, windowSeconds: 60 * 60 },
} as const;

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Listing not found.' });

/** When a listing posted or renewed at `from` leaves the marketplace. */
export function listingExpiry(from: Date): Date {
  return new Date(from.getTime() + MARKETPLACE_LIMITS.openDays * DAY_MS);
}

const SORTS: Record<ListingBrowseQuery['sort'], Prisma.ListingOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ priceTaka: 'asc' }, { id: 'asc' }],
  price_desc: [{ priceTaka: 'desc' }, { id: 'desc' }],
};

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly rateLimit: RateLimitService,
    /** Present only when moderation (and admin) are switched on; without it nothing can be held. */
    @Optional() private readonly moderation?: ModerationService,
  ) {}

  /** Available and reserved listings that are not expired or moderated. */
  async browse(viewerId: string, query: ListingBrowseQuery): Promise<ListingPage> {
    const price: Prisma.IntFilter = {};
    if (query.minPrice !== undefined) price.gte = query.minPrice;
    if (query.maxPrice !== undefined) price.lte = query.maxPrice;
    const where: Prisma.ListingWhereInput = {
      status: 'visible',
      state: { in: ['available', 'reserved'] },
      expiresAt: { gt: new Date() },
      ...(query.category ? { category: query.category } : {}),
      ...(Object.keys(price).length ? { priceTaka: price } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.page(viewerId, where, SORTS[query.sort], query);
  }

  async mine(userId: string, query: CursorPageQuery): Promise<ListingPage> {
    return this.page(userId, { createdById: userId }, SORTS.newest, query);
  }

  async get(viewerId: string, id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw notFound();
    const insider = listing.createdById === viewerId || (await this.isStaff(viewerId));
    if ((listing.status !== 'visible' || listing.state === 'sold') && !insider) throw notFound();
    return this.presentOne(listing, viewerId);
  }

  async create(userId: string, input: ListingInput): Promise<Listing> {
    await this.requireActive(userId);
    await this.rateLimit.consume(MARKETPLACE_RATE_LIMITS.create, userId);
    const held = this.heldTerm(input);
    const listing = await this.prisma.listing.create({
      data: {
        ...this.fields(input),
        createdById: userId,
        expiresAt: listingExpiry(new Date()),
        ...(held ? { status: 'hidden', heldTerm: held } : {}),
      },
    });
    await this.media.attach(userId, 'marketplace.listing', listing.id, input.mediaIds);
    if (held) await this.hold(listing.id, held);
    return this.presentOne(listing, userId);
  }

  async update(userId: string, id: string, input: ListingInput): Promise<Listing> {
    await this.requireActive(userId);
    const listing = await this.owned(userId, id);
    if (listing.status === 'removed') throw this.forbidden('A moderator removed this listing.');
    await this.rateLimit.consume(MARKETPLACE_RATE_LIMITS.edit, userId);
    await this.media.attach(userId, 'marketplace.listing', id, input.mediaIds);
    // An edit that adds a held term goes back to moderators; one already waiting stays waiting.
    const held = this.heldTerm(input);
    const newlyHeld = held && listing.status === 'visible';
    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        ...this.fields(input),
        ...(newlyHeld ? { status: 'hidden', heldTerm: held } : {}),
      },
    });
    if (newlyHeld) await this.hold(id, held);
    return this.presentOne(updated, userId);
  }

  async setState(userId: string, id: string, state: ListingState): Promise<Listing> {
    await this.requireActive(userId);
    await this.owned(userId, id);
    await this.rateLimit.consume(MARKETPLACE_RATE_LIMITS.edit, userId);
    const updated = await this.prisma.listing.update({ where: { id }, data: { state } });
    return this.presentOne(updated, userId);
  }

  /** Another 30 days on the marketplace. */
  async renew(userId: string, id: string): Promise<Listing> {
    await this.requireActive(userId);
    await this.owned(userId, id);
    await this.rateLimit.consume(MARKETPLACE_RATE_LIMITS.edit, userId);
    const updated = await this.prisma.listing.update({
      where: { id },
      data: { expiresAt: listingExpiry(new Date()) },
    });
    return this.presentOne(updated, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.media.releaseContent('marketplace.listing', id);
    await this.prisma.listing.delete({ where: { id } });
  }

  // ----- helpers -----

  /** Held only when moderators exist to look at it. */
  private heldTerm(input: ListingInput): string | null {
    if (!this.moderation) return null;
    return heldTermIn(`${input.title} ${input.description}`);
  }

  private async hold(id: string, term: string) {
    await this.moderation?.holdForReview(
      'marketplace.listing',
      id,
      `Held automatically: mentions “${term}”. Restore it if it is allowed, or remove it.`,
    );
  }

  private fields(input: ListingInput) {
    return {
      title: input.title,
      category: input.category,
      condition: input.condition,
      priceTaka: input.priceTaka,
      description: input.description,
      meetPlace: input.meetPlace,
      meetDetail: input.meetDetail,
    };
  }

  private forbidden(message: string) {
    return new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
  }

  private async owned(userId: string, id: string): Promise<ListingRow> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw notFound();
    if (listing.createdById !== userId)
      throw this.forbidden('You can only change your own listings.');
    return listing;
  }

  private async isStaff(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return (
      !!user && user.status === 'active' && (STAFF_ROLES as readonly string[]).includes(user.role)
    );
  }

  /** Suspended and banned members cannot sell (CLAUDE.md §7). */
  private async requireActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended, so you cannot sell.',
      });
    }
    return user;
  }

  private async page(
    viewerId: string,
    where: Prisma.ListingWhereInput,
    orderBy: Prisma.ListingOrderByWithRelationInput[],
    query: CursorPageQuery,
  ): Promise<ListingPage> {
    const rows = await this.prisma.listing.findMany({
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

  private async presentOne(row: ListingRow, viewerId: string): Promise<Listing> {
    const [listing] = await this.present([row], viewerId);
    return listing!;
  }

  private async present(rows: ListingRow[], viewerId: string): Promise<Listing[]> {
    if (rows.length === 0) return [];
    const [sellers, photos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
        select: { id: true, name: true, role: true },
      }),
      this.media.forContent(
        'marketplace.listing',
        rows.map((r) => r.id),
      ),
    ]);
    const byId = new Map(sellers.map((s) => [s.id, s]));
    const now = Date.now();
    return rows.map((row) => {
      const mine = row.createdById === viewerId;
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        condition: row.condition,
        priceTaka: row.priceTaka,
        description: row.description,
        meetPlace: row.meetPlace,
        meetDetail: row.meetDetail,
        photos: photos.get(row.id) ?? [],
        seller: byId.get(row.createdById) ?? null,
        state: row.state,
        expired: row.state !== 'sold' && row.expiresAt.getTime() <= now,
        expiresAt: row.expiresAt.toISOString(),
        moderated: row.status !== 'visible',
        heldFor: mine && row.status === 'hidden' ? row.heldTerm : null,
        isMine: mine,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
