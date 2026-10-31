import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CLASS_REP_ELIGIBLE_ROLES,
  type ClassRepApplyRequest,
  type ClassRepRequest,
  type ClassRepReviewItem,
  type ClassRepReviewPage,
  type ClassRepReviewQuery,
  departmentFromRoll,
  ERROR_CODES,
  type MyClassRep,
  seriesFromRoll,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import {
  type ClassRepRequest as ClassRepRow,
  Prisma,
  type User,
} from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const FIFTEEN_MINUTES = 15 * 60;
const ONE_DAY = 24 * 60 * 60;

export const CLASS_REP_RATE_LIMITS = {
  apply: { name: 'users:class-rep:apply', limit: 5, windowSeconds: ONE_DAY },
  review: { name: 'users:class-rep:review', limit: 120, windowSeconds: FIFTEEN_MINUTES },
} as const;

const OPEN: ClassRepRow['status'][] = ['pending', 'approved'];
const APPROVE_REASON = 'Verified as class representative.';

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Request not found.' });
const forbidden = (message: string) =>
  new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
const conflict = (message: string) =>
  new ConflictException({ code: ERROR_CODES.CONFLICT, message });

function present(row: ClassRepRow): ClassRepRequest {
  return {
    id: row.id,
    status: row.status,
    section: row.section,
    note: row.note,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

/** "CSE 2021, section A": the class a request is for, for messages and notifications. */
function className(roll: string, section: string | null): string {
  const department = departmentFromRoll(roll)?.short ?? 'your class';
  const series = seriesFromRoll(roll);
  return [department, series, section ? `section ${section}` : null].filter(Boolean).join(' ');
}

/**
 * Class representative verification: a student asks, staff approve or reject, and it lasts until
 * the student steps down or staff revoke it. Staff actions go to admin's moderation log, so this
 * service (and its controller) exist only when FEATURE_ADMIN is on. See docs/modules/users.md.
 */
@Injectable()
export class ClassRepsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly log: ModerationLogService,
    /** Present only when the notifications module is switched on. */
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async mine(userId: string): Promise<MyClassRep> {
    const row = await this.prisma.classRepRequest.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return { request: row ? present(row) : null };
  }

  async apply(userId: string, input: ClassRepApplyRequest): Promise<MyClassRep> {
    const user = await this.requireActive(userId);
    if (!(CLASS_REP_ELIGIBLE_ROLES as readonly string[]).includes(user.role)) {
      throw forbidden('Only current students can be class representatives.');
    }
    // The class comes from the roll, so it must be one we recognise.
    if (!departmentFromRoll(user.roll) || seriesFromRoll(user.roll) === null) {
      throw new BadRequestException({
        code: ERROR_CODES.BAD_REQUEST,
        message: 'We cannot tell your class from your roll. Please contact a moderator.',
      });
    }
    if (await this.findOpen(userId)) {
      throw conflict('You already have a request waiting, or you are already a CR.');
    }
    await this.rateLimit.consume(CLASS_REP_RATE_LIMITS.apply, userId);
    try {
      const row = await this.prisma.classRepRequest.create({
        data: { userId, section: input.section, note: input.note },
      });
      return { request: present(row) };
    } catch (error) {
      // Two taps at once: the partial unique index lets only one open request through.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('You already have a request waiting, or you are already a CR.');
      }
      throw error;
    }
  }

  /** Takes back a waiting request, or steps down as CR. */
  async withdraw(userId: string): Promise<MyClassRep> {
    const open = await this.findOpen(userId);
    if (!open) throw notFound();
    const row = await this.prisma.classRepRequest.update({
      where: { id: open.id },
      data:
        open.status === 'pending'
          ? { status: 'withdrawn' }
          : { status: 'revoked', reviewNote: 'Stepped down.', reviewedAt: new Date() },
    });
    return { request: present(row) };
  }

  /** Staff: waiting requests (oldest first), or current CRs (newest first). */
  async list(staffId: string, query: ClassRepReviewQuery): Promise<ClassRepReviewPage> {
    await this.requireStaff(staffId);
    const rows = await this.prisma.classRepRequest.findMany({
      where: { status: query.status },
      orderBy: [{ createdAt: query.status === 'pending' ? 'asc' : 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const users = await this.prisma.user.findMany({
      where: { id: { in: page.map((row) => row.userId) } },
      select: { id: true, name: true, roll: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return {
      items: page.flatMap((row): ClassRepReviewItem[] => {
        const user = byId.get(row.userId);
        if (!user) return [];
        const department = departmentFromRoll(user.roll);
        return [
          {
            ...present(row),
            user: {
              id: user.id,
              name: user.name,
              roll: user.roll,
              department: department
                ? { code: department.code, short: department.short, name: department.name }
                : null,
              series: seriesFromRoll(user.roll),
            },
          },
        ];
      }),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  approve(staffId: string, id: string): Promise<ClassRepRequest> {
    return this.decide(staffId, id, 'pending', 'approved', APPROVE_REASON);
  }

  reject(staffId: string, id: string, reason: string): Promise<ClassRepRequest> {
    return this.decide(staffId, id, 'pending', 'rejected', reason);
  }

  revoke(staffId: string, id: string, reason: string): Promise<ClassRepRequest> {
    return this.decide(staffId, id, 'approved', 'revoked', reason);
  }

  // ----- helpers -----

  private async decide(
    staffId: string,
    id: string,
    from: ClassRepRow['status'],
    to: 'approved' | 'rejected' | 'revoked',
    reason: string,
  ): Promise<ClassRepRequest> {
    await this.requireStaff(staffId);
    await this.rateLimit.consume(CLASS_REP_RATE_LIMITS.review, staffId);
    const request = await this.prisma.classRepRequest.findUnique({ where: { id } });
    if (!request || request.status !== from) throw notFound();
    if (request.userId === staffId)
      throw forbidden('Another staff member must review your request.');
    const owner = await this.prisma.user.findUnique({ where: { id: request.userId } });
    if (!owner) throw notFound();

    const action = {
      approved: 'verify_class_rep',
      rejected: 'reject_class_rep',
      revoked: 'revoke_class_rep',
    } as const;
    const [, updated] = await this.prisma.$transaction([
      this.log.record({
        moderatorId: staffId,
        action: action[to],
        targetUserId: request.userId,
        reason,
        details: { requestId: id, section: request.section },
      }),
      this.prisma.classRepRequest.update({
        where: { id },
        data: {
          status: to,
          reviewNote: to === 'approved' ? null : reason,
          reviewedById: staffId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    const label = className(owner.roll, request.section);
    const message = {
      approved: { title: `You are now a verified CR for ${label}`, body: null },
      rejected: {
        title: 'Your class representative request was not approved',
        body: `Moderator's reason: ${reason}`,
      },
      revoked: {
        title: `Your class representative status for ${label} was removed`,
        body: `Moderator's reason: ${reason}`,
      },
    }[to];
    await this.notifications?.notify([request.userId], {
      type: `users.class_rep_${to}`,
      ...message,
      link: '/profile',
    });
    return present(updated);
  }

  private findOpen(userId: string) {
    return this.prisma.classRepRequest.findFirst({
      where: { userId, status: { in: OPEN } },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /** Suspended and banned members cannot apply. */
  private async requireActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended, so you cannot do this.',
      });
    }
    return user;
  }

  /** From the database, so a demoted moderator loses access at once. */
  private async requireStaff(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.status !== 'active' ||
      !(STAFF_ROLES as readonly string[]).includes(user.role)
    ) {
      throw forbidden('You do not have permission to do this.');
    }
  }
}
