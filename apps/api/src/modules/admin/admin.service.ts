import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type AdminUser,
  type AdminUserDetail,
  type AdminUserListQuery,
  type AdminUserPage,
  ERROR_CODES,
  formatDateTime,
  type Role,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MailService } from '../../core/mail/mail.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { SessionsService } from '../auth/sessions.service.js';
import { ModerationLogService } from './moderation-log.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ADMIN_RATE_LIMITS = {
  // A compromised staff account should not be able to ban half the platform in a minute.
  actions: { name: 'admin:actions', limit: 60, windowSeconds: 15 * 60 },
} as const;

const adminUserSelect = {
  id: true,
  name: true,
  roll: true,
  role: true,
  status: true,
  suspendedUntil: true,
  createdAt: true,
} as const;

type AdminUserRow = Pick<
  User,
  'id' | 'name' | 'roll' | 'role' | 'status' | 'suspendedUntil' | 'createdAt'
>;

function toAdminUser(user: AdminUserRow): AdminUser {
  return {
    id: user.id,
    name: user.name,
    roll: user.roll,
    role: user.role,
    status: user.status,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const forbidden = (message: string) =>
  new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
const conflict = (message: string) =>
  new ConflictException({ code: ERROR_CODES.CONFLICT, message });

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly log: ModerationLogService,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async listUsers(query: AdminUserListQuery): Promise<AdminUserPage> {
    const and: Prisma.UserWhereInput[] = [];
    if (query.q) {
      and.push(
        /^\d+$/.test(query.q)
          ? { roll: { startsWith: query.q } }
          : { name: { contains: query.q, mode: 'insensitive' } },
      );
    }
    if (query.role) and.push({ role: query.role });
    if (query.status) and.push({ status: query.status });

    const rows = await this.prisma.user.findMany({
      where: { AND: and },
      select: adminUserSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toAdminUser),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async getUser(id: string): Promise<AdminUserDetail> {
    const user = await this.findTarget(id);
    return { user: toAdminUser(user), history: await this.log.forUser(id) };
  }

  async warn(actorId: string, targetId: string, reason: string): Promise<AdminUserDetail> {
    const { target } = await this.authorize(actorId, targetId);
    await this.log.record({
      moderatorId: actorId,
      action: 'warn_user',
      targetUserId: target.id,
      reason,
    });
    await this.notify(target, 'You have received a warning', [
      'A RUET Chottor moderator has warned you.',
      `Reason: ${reason}`,
      'Please follow the community rules. Repeated problems can lead to a suspension.',
    ]);
    return this.getUser(target.id);
  }

  async suspend(
    actorId: string,
    targetId: string,
    reason: string,
    days: number,
  ): Promise<AdminUserDetail> {
    const { target } = await this.authorize(actorId, targetId);
    if (target.status === 'banned') throw conflict('This member is banned. Reinstate them first.');
    const until = new Date(Date.now() + days * DAY_MS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { status: 'suspended', suspendedUntil: until },
      }),
      this.log.record({
        moderatorId: actorId,
        action: 'suspend_user',
        targetUserId: target.id,
        reason,
        details: { days, until: until.toISOString() },
      }),
    ]);
    await this.sessions.revokeAllForUser(target.id);
    await this.notify(target, 'Your account has been suspended', [
      `A RUET Chottor moderator has suspended your account until ${formatDateTime(until)} (Bangladesh time).`,
      `Reason: ${reason}`,
      'You can log in again after that time.',
    ]);
    return this.getUser(target.id);
  }

  async ban(actorId: string, targetId: string, reason: string): Promise<AdminUserDetail> {
    const { target } = await this.authorize(actorId, targetId);
    if (target.status === 'banned') throw conflict('This member is already banned.');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { status: 'banned', suspendedUntil: null },
      }),
      this.log.record({
        moderatorId: actorId,
        action: 'ban_user',
        targetUserId: target.id,
        reason,
      }),
    ]);
    await this.sessions.revokeAllForUser(target.id);
    await this.notify(target, 'Your account has been banned', [
      'A RUET Chottor moderator has banned your account.',
      `Reason: ${reason}`,
    ]);
    return this.getUser(target.id);
  }

  async reinstate(actorId: string, targetId: string, reason: string): Promise<AdminUserDetail> {
    const { target } = await this.authorize(actorId, targetId);
    if (target.status === 'active') throw conflict('This member is not suspended or banned.');
    // The log entry is built first: it records the values from before the update.
    await this.prisma.$transaction([
      this.log.record({
        moderatorId: actorId,
        action: 'reinstate_user',
        targetUserId: target.id,
        reason,
        details: { from: target.status },
      }),
      this.prisma.user.update({
        where: { id: target.id },
        data: { status: 'active', suspendedUntil: null },
      }),
    ]);
    await this.notify(target, 'Your account is active again', [
      'A RUET Chottor moderator has restored your account. You can log in again.',
    ]);
    return this.getUser(target.id);
  }

  async changeRole(
    actorId: string,
    targetId: string,
    role: Role,
    reason: string,
  ): Promise<AdminUserDetail> {
    const { target } = await this.authorize(actorId, targetId, { adminOnly: true });
    if (target.role === role) throw conflict('The member already has this role.');
    await this.prisma.$transaction([
      this.log.record({
        moderatorId: actorId,
        action: 'change_role',
        targetUserId: target.id,
        reason,
        details: { from: target.role, to: role },
      }),
      this.prisma.user.update({ where: { id: target.id }, data: { role } }),
    ]);
    return this.getUser(target.id);
  }

  /**
   * The route guard already checked the role in the access token; this re-reads it from the
   * database so a demoted or suspended moderator cannot keep acting for up to 15 minutes.
   */
  private async authorize(actorId: string, targetId: string, { adminOnly = false } = {}) {
    await this.rateLimit.consume(ADMIN_RATE_LIMITS.actions, actorId);
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    const allowed: readonly Role[] = adminOnly ? ['admin'] : STAFF_ROLES;
    if (!actor || actor.status !== 'active' || !allowed.includes(actor.role)) {
      throw forbidden('You do not have permission to do this.');
    }
    const target = await this.findTarget(targetId);
    if (target.id === actor.id) throw forbidden('You cannot moderate your own account.');
    if ((STAFF_ROLES as readonly Role[]).includes(target.role) && actor.role !== 'admin') {
      throw forbidden('Only an admin can act on moderators and admins.');
    }
    return { actor, target };
  }

  private async findTarget(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'User not found.' });
    return user;
  }

  /** Telling the member is best effort: the action itself already happened and is logged. */
  private async notify(user: User, subject: string, lines: string[]) {
    try {
      await this.mail.send({
        to: user.email,
        subject: `RUET Chottor: ${subject}`,
        text: [`Hi ${user.name},`, '', ...lines].join('\n'),
      });
    } catch (error) {
      this.logger.warn(`Could not email user ${user.id}: ${String(error)}`);
    }
  }
}
