import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
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

/** Public view with privacy applied. Exported for the directory module. */
export function toPublicProfile(user: UserRow): PublicProfile {
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
  };
}

function toMyProfile(user: UserRow): MyProfile {
  const settings = user.profile ?? DEFAULT_SETTINGS;
  return {
    ...toPublicProfile(user),
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
    return toMyProfile(await this.findSelf(userId));
  }

  /** Suspended and banned members are hidden, as if they did not exist. */
  async getPublic(id: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user || user.status !== 'active') {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found.' });
    }
    return toPublicProfile(user);
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
