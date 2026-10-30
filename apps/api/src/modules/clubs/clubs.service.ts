import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type ClubDetail,
  type ClubLink,
  type ClubListQuery,
  type ClubMemberPage,
  type ClubMembersQuery,
  type ClubPage,
  type ClubRef,
  type ClubSummary,
  clubSlug,
  type CreateClubRequest,
  ERROR_CODES,
  type Role,
  type UpdateClubRequest,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import {
  type Club as ClubRow,
  type ClubMembership,
  Prisma,
  type User,
} from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';

export const CLUBS_RATE_LIMITS = {
  join: { name: 'clubs:join', limit: 30, windowSeconds: 60 * 60 },
  manage: { name: 'clubs:manage', limit: 120, windowSeconds: 60 * 60 },
} as const;

/** Roles that become club_manager when appointed. Staff keep their stronger role. */
const PROMOTABLE: Role[] = ['student', 'alumni', 'teacher'];

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Club not found.' });
const forbidden = (message: string) =>
  new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
const badRequest = (message: string) =>
  new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message });

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly log: ModerationLogService,
    private readonly rateLimit: RateLimitService,
  ) {}

  // ----- reading -----

  async list(viewerId: string, query: ClubListQuery): Promise<ClubPage> {
    const where: Prisma.ClubWhereInput = {
      status: 'visible',
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const rows = await this.prisma.club.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.summaries(page, viewerId),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** Clubs the viewer manages, belongs to or asked to join. */
  async mine(viewerId: string): Promise<ClubSummary[]> {
    const memberships = await this.prisma.clubMembership.findMany({ where: { userId: viewerId } });
    if (memberships.length === 0) return [];
    const rows = await this.prisma.club.findMany({
      where: { id: { in: memberships.map((m) => m.clubId) } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return this.summaries(rows, viewerId);
  }

  async getBySlug(viewerId: string, slug: string): Promise<ClubDetail> {
    const club = await this.prisma.club.findUnique({ where: { slug } });
    if (!club) throw notFound();
    const canEdit = await this.canManage(viewerId, club.id);
    // Moderated clubs are gone for members, but managers and staff still see why.
    if (club.status !== 'visible' && !canEdit) throw notFound();
    return this.detail(club, viewerId, canEdit);
  }

  async members(
    viewerId: string,
    clubId: string,
    query: ClubMembersQuery,
  ): Promise<ClubMemberPage> {
    const club = await this.visibleOrManaged(viewerId, clubId);
    if (query.state === 'pending' && !(await this.canManage(viewerId, club.id))) {
      throw forbidden('Only the club’s managers can see join requests.');
    }
    const rows = await this.prisma.clubMembership.findMany({
      where: { clubId, state: query.state },
      orderBy: [{ requestedAt: 'asc' }],
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, roll: true, role: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    // Managers first, then by name; paged by offset as lists are small.
    const people = rows
      .flatMap((row) => {
        const user = byId.get(row.userId);
        return user ? [{ row, user }] : [];
      })
      .sort(
        (a, b) =>
          Number(b.row.role === 'manager') - Number(a.row.role === 'manager') ||
          a.user.name.localeCompare(b.user.name),
      );
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const page = people.slice(offset, offset + query.limit);
    return {
      items: page.map(({ row, user }) => ({
        id: user.id,
        name: user.name,
        roll: user.roll,
        role: user.role,
        clubRole: row.role,
        state: row.state,
        since: (row.joinedAt ?? row.requestedAt).toISOString(),
      })),
      nextCursor: offset + query.limit < people.length ? String(offset + query.limit) : null,
    };
  }

  // ----- admins -----

  async create(adminId: string, input: CreateClubRequest): Promise<ClubDetail> {
    await this.requireAdmin(adminId);
    await this.rateLimit.consume(CLUBS_RATE_LIMITS.manage, adminId);
    const managers = await this.requireActiveUsers(input.managerIds);
    const slug = clubSlug(input.name);
    try {
      const club = await this.prisma.club.create({
        data: {
          name: input.name,
          slug,
          tagline: input.tagline,
          category: input.category,
          about: input.about,
          createdById: adminId,
          memberships: {
            create: managers.map((user) => ({
              userId: user.id,
              role: 'manager' as const,
              state: 'active' as const,
              joinedAt: new Date(),
            })),
          },
        },
      });
      await this.promote(adminId, managers, club.name);
      return this.detail(club, adminId, true);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'A club with this name already exists.',
        });
      }
      throw error;
    }
  }

  /** Makes exactly these people the club's managers; former managers stay as members. */
  async setManagers(adminId: string, clubId: string, userIds: string[]): Promise<ClubDetail> {
    await this.requireAdmin(adminId);
    await this.rateLimit.consume(CLUBS_RATE_LIMITS.manage, adminId);
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw notFound();
    const managers = await this.requireActiveUsers(userIds);
    const existing = await this.prisma.clubMembership.findMany({ where: { clubId } });
    const now = new Date();

    for (const membership of existing) {
      if (membership.role === 'manager' && !userIds.includes(membership.userId)) {
        await this.prisma.clubMembership.update({
          where: { clubId_userId: { clubId, userId: membership.userId } },
          data: { role: 'member' },
        });
      }
    }
    for (const user of managers) {
      const membership = existing.find((m) => m.userId === user.id);
      if (membership) {
        await this.prisma.clubMembership.update({
          where: { clubId_userId: { clubId, userId: user.id } },
          data: { role: 'manager', state: 'active', joinedAt: membership.joinedAt ?? now },
        });
      } else {
        await this.prisma.clubMembership.create({
          data: { clubId, userId: user.id, role: 'manager', state: 'active', joinedAt: now },
        });
      }
    }
    await this.promote(adminId, managers, club.name);
    return this.detail(club, adminId, true);
  }

  // ----- managers -----

  async update(userId: string, clubId: string, input: UpdateClubRequest): Promise<ClubDetail> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw notFound();
    await this.requireActive(userId);
    if (!(await this.canManage(userId, clubId))) {
      throw forbidden('Only the club’s managers can edit it.');
    }
    if (input.name !== undefined && input.name !== club.name && !(await this.isAdmin(userId))) {
      throw forbidden('Only admins can rename a club.');
    }
    if (club.status === 'removed') throw forbidden('A moderator removed this club.');
    await this.rateLimit.consume(CLUBS_RATE_LIMITS.manage, userId);

    await this.media.attach(userId, 'clubs.logo', clubId, input.logoId ? [input.logoId] : []);
    await this.media.attach(userId, 'clubs.cover', clubId, input.coverId ? [input.coverId] : []);
    const renamed = input.name !== undefined && input.name !== club.name;
    try {
      const updated = await this.prisma.club.update({
        where: { id: clubId },
        data: {
          ...(renamed ? { name: input.name, slug: clubSlug(input.name!) } : {}),
          tagline: input.tagline,
          category: input.category,
          about: input.about,
          contactEmail: input.contactEmail,
          links: input.links,
        },
      });
      return this.detail(updated, userId, true);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'A club with this name already exists.',
        });
      }
      throw error;
    }
  }

  async approve(managerId: string, clubId: string, userId: string): Promise<void> {
    await this.requireManager(managerId, clubId);
    const membership = await this.membership(clubId, userId);
    if (!membership || membership.state !== 'pending') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'No such request.' });
    }
    await this.prisma.clubMembership.update({
      where: { clubId_userId: { clubId, userId } },
      data: { state: 'active', joinedAt: new Date() },
    });
  }

  /** Declines a request or removes a member. Managers are changed by admins only. */
  async removeMember(managerId: string, clubId: string, userId: string): Promise<void> {
    await this.requireManager(managerId, clubId);
    const membership = await this.membership(clubId, userId);
    if (!membership) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Not a member.' });
    }
    if (membership.role === 'manager') throw badRequest('Ask an admin to change the managers.');
    await this.prisma.clubMembership.delete({ where: { clubId_userId: { clubId, userId } } });
  }

  // ----- members -----

  async join(userId: string, clubId: string): Promise<ClubDetail> {
    await this.requireActive(userId);
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club || club.status !== 'visible') throw notFound();
    await this.rateLimit.consume(CLUBS_RATE_LIMITS.join, userId);
    try {
      await this.prisma.clubMembership.create({ data: { clubId, userId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'You are already a member or have asked to join.',
        });
      }
      throw error;
    }
    return this.detail(club, userId, false);
  }

  /** Leave the club, or take back a join request. The last manager cannot leave. */
  async leave(userId: string, clubId: string): Promise<void> {
    const membership = await this.membership(clubId, userId);
    if (!membership) throw notFound();
    if (membership.role === 'manager') {
      const managers = await this.prisma.clubMembership.count({
        where: { clubId, role: 'manager' },
      });
      if (managers <= 1) throw badRequest('You are the only manager. Ask an admin to add another.');
    }
    await this.prisma.clubMembership.delete({ where: { clubId_userId: { clubId, userId } } });
  }

  // ----- for other modules (news) -----

  async isManager(userId: string, clubId: string): Promise<boolean> {
    const membership = await this.membership(clubId, userId);
    return membership?.role === 'manager' && membership.state === 'active';
  }

  /** Which of these clubs the user manages: one query for a whole list. */
  async managedAmong(userId: string, clubIds: string[]): Promise<Set<string>> {
    if (clubIds.length === 0) return new Set();
    const rows = await this.prisma.clubMembership.findMany({
      where: { userId, clubId: { in: [...new Set(clubIds)] }, role: 'manager', state: 'active' },
    });
    return new Set(rows.map((m) => m.clubId));
  }

  /** Name and link of each club, for showing "posted by <club>". */
  async refs(clubIds: string[]): Promise<Map<string, ClubRef>> {
    if (clubIds.length === 0) return new Map();
    const rows = await this.prisma.club.findMany({ where: { id: { in: [...new Set(clubIds)] } } });
    return new Map(rows.map((c) => [c.id, { id: c.id, slug: c.slug, name: c.name }]));
  }

  // ----- helpers -----

  private membership(clubId: string, userId: string): Promise<ClubMembership | null> {
    return this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
  }

  private async user(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.user(userId);
    return user?.status === 'active' && user.role === 'admin';
  }

  /** The club's active managers and admins. Moderators act through the Reports queue. */
  private async canManage(userId: string, clubId: string): Promise<boolean> {
    return (await this.isAdmin(userId)) || (await this.isManager(userId, clubId));
  }

  private async requireAdmin(userId: string) {
    if (!(await this.isAdmin(userId))) throw forbidden('Only admins can do this.');
  }

  private async requireManager(userId: string, clubId: string) {
    await this.requireActive(userId);
    if (!(await this.canManage(userId, clubId))) {
      throw forbidden('Only the club’s managers can do this.');
    }
  }

  private async requireActive(userId: string): Promise<User> {
    const user = await this.user(userId);
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended.',
      });
    }
    return user;
  }

  private async requireActiveUsers(ids: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, status: 'active' } });
    if (users.length !== ids.length) throw badRequest('One of these people cannot be a manager.');
    return users;
  }

  private async visibleOrManaged(viewerId: string, clubId: string): Promise<ClubRow> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw notFound();
    if (club.status !== 'visible' && !(await this.canManage(viewerId, clubId))) throw notFound();
    return club;
  }

  /** Appointed managers get the club_manager role (logged like any role change). */
  private async promote(adminId: string, users: User[], clubName: string) {
    for (const user of users.filter((u) => PROMOTABLE.includes(u.role))) {
      await this.prisma.$transaction([
        this.log.record({
          moderatorId: adminId,
          action: 'change_role',
          targetUserId: user.id,
          reason: `Appointed manager of ${clubName}.`,
          details: { from: user.role, to: 'club_manager' },
        }),
        this.prisma.user.update({ where: { id: user.id }, data: { role: 'club_manager' } }),
      ]);
    }
  }

  private async summaries(rows: ClubRow[], viewerId: string): Promise<ClubSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [logos, mine, counts] = await Promise.all([
      this.media.forContent('clubs.logo', ids),
      this.prisma.clubMembership.findMany({ where: { userId: viewerId, clubId: { in: ids } } }),
      this.prisma.clubMembership.groupBy({
        by: ['clubId'],
        where: { clubId: { in: ids }, state: 'active' },
        _count: { _all: true },
      }),
    ]);
    const memberCounts = new Map(counts.map((c) => [c.clubId, c._count._all]));
    return rows.map((row) => {
      const membership = mine.find((m) => m.clubId === row.id);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        tagline: row.tagline,
        category: row.category,
        logo: logos.get(row.id)?.[0] ?? null,
        memberCount: memberCounts.get(row.id) ?? 0,
        myMembership: membership ? { role: membership.role, state: membership.state } : null,
        moderated: row.status !== 'visible',
      };
    });
  }

  private async detail(club: ClubRow, viewerId: string, canEdit: boolean): Promise<ClubDetail> {
    const [[summary], covers, managerRows] = await Promise.all([
      this.summaries([club], viewerId),
      this.media.forContent('clubs.cover', [club.id]),
      this.prisma.clubMembership.findMany({
        where: { clubId: club.id, role: 'manager', state: 'active' },
      }),
    ]);
    const managers = await this.prisma.user.findMany({
      where: { id: { in: managerRows.map((m) => m.userId) } },
      select: { id: true, name: true, role: true },
    });
    return {
      ...summary!,
      about: club.about,
      cover: covers.get(club.id)?.[0] ?? null,
      contactEmail: club.contactEmail,
      links: (club.links as ClubLink[] | null) ?? [],
      managers: managers
        .map((m) => ({ id: m.id, name: m.name, role: m.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      canEdit: canEdit && club.status !== 'removed',
    };
  }
}
