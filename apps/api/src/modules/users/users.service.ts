import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  type ClassRepBadge,
  departmentFromRoll,
  ERROR_CODES,
  MAX_DISMISSED_GUIDES,
  type MyProfile,
  type PublicProfile,
  seriesFromRoll,
  type UpdateMyProfileRequest,
} from '@ruet-chottor/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const FIFTEEN_MINUTES = 15 * 60;

export const USERS_RATE_LIMITS = {
  updateProfile: { name: 'users:update', limit: 30, windowSeconds: FIFTEEN_MINUTES },
  guides: { name: 'users:guides', limit: 60, windowSeconds: FIFTEEN_MINUTES },
} as const;

/** Only these columns ever leave the database: never the password hash or date of birth. */
const userSelect = {
  id: true,
  name: true,
  roll: true,
  role: true,
  status: true,
  email: true,
  phone: true,
  profile: { select: { showEmail: true, showPhone: true, dismissedGuides: true } },
} as const;

type UserRow = {
  id: string;
  name: string;
  roll: string;
  role: PublicProfile['role'];
  status: string;
  email: string;
  phone: string;
  profile: { showEmail: boolean; showPhone: boolean; dismissedGuides: string[] } | null;
};

const DEFAULT_SETTINGS = { showEmail: false, showPhone: false, dismissedGuides: [] as string[] };

/** Public view with privacy applied. `classRep` is the badge while they are a verified CR. */
function toPublicProfile(user: UserRow, classRep: ClassRepBadge | null): PublicProfile {
  const settings = user.profile ?? DEFAULT_SETTINGS;
  const department = departmentFromRoll(user.roll);
  return {
    id: user.id,
    name: user.name,
    roll: user.roll,
    role: user.role,
    department: department
      ? { code: department.code, short: department.short, name: department.name }
      : null,
    series: seriesFromRoll(user.roll),
    email: settings.showEmail ? user.email : null,
    phone: settings.showPhone ? user.phone : null,
    classRep,
  };
}

function toMyProfile(user: UserRow, classRep: ClassRepBadge | null): MyProfile {
  const settings = user.profile ?? DEFAULT_SETTINGS;
  return {
    ...toPublicProfile(user, classRep),
    email: user.email,
    phone: user.phone,
    showEmail: settings.showEmail,
    showPhone: settings.showPhone,
    dismissedGuides: settings.dismissedGuides,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async getMine(userId: string): Promise<MyProfile> {
    const user = await this.findSelf(userId);
    const badges = await this.classRepBadges([user.id]);
    return toMyProfile(user, badges.get(user.id) ?? null);
  }

  /** Suspended and banned members are hidden, as if they did not exist. */
  async getPublic(id: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user || user.status !== 'active') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found.' });
    }
    const badges = await this.classRepBadges([user.id]);
    return toPublicProfile(user, badges.get(user.id) ?? null);
  }

  /**
   * A page of active members, privacy applied, sorted by name. For other modules (e.g. directory)
   * that decide *who* to list; this module decides *what* is shown.
   */
  async listPublic(options: {
    where: Prisma.UserWhereInput;
    cursor?: string;
    take: number;
  }): Promise<{ items: PublicProfile[]; nextCursor: string | null }> {
    const rows = await this.prisma.user.findMany({
      where: { AND: [options.where, { status: 'active' }] },
      select: userSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: options.take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > options.take;
    const page = hasMore ? rows.slice(0, options.take) : rows;
    const badges = await this.classRepBadges(page.map((user) => user.id));
    return {
      items: page.map((user) => toPublicProfile(user, badges.get(user.id) ?? null)),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async updateMine(userId: string, input: UpdateMyProfileRequest): Promise<MyProfile> {
    await this.rateLimit.consume(USERS_RATE_LIMITS.updateProfile, userId);
    await this.findSelf(userId);
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return this.getMine(userId);
  }

  async dismissGuide(userId: string, key: string): Promise<string[]> {
    await this.rateLimit.consume(USERS_RATE_LIMITS.guides, userId);
    const user = await this.findSelf(userId);
    const current = user.profile?.dismissedGuides ?? [];
    if (current.includes(key)) return current;
    const dismissedGuides = [...current, key].slice(-MAX_DISMISSED_GUIDES);
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, dismissedGuides },
      update: { dismissedGuides },
    });
    return dismissedGuides;
  }

  /** "Show tips again": every first-visit guide shows once more. */
  async resetGuides(userId: string): Promise<string[]> {
    await this.rateLimit.consume(USERS_RATE_LIMITS.guides, userId);
    await this.findSelf(userId);
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: { dismissedGuides: [] },
    });
    return [];
  }

  /** Approved class representatives among these members (see ClassRepsService). */
  private async classRepBadges(userIds: string[]): Promise<Map<string, ClassRepBadge>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.classRepRequest.findMany({
      where: { userId: { in: userIds }, status: 'approved' },
    });
    return new Map(
      rows.map((row) => [
        row.userId,
        { section: row.section, since: (row.reviewedAt ?? row.createdAt).toISOString() },
      ]),
    );
  }

  private async findSelf(userId: string): Promise<UserRow> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Please log in to continue.',
      });
    }
    return user;
  }
}
