import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  type CampusEvent,
  type ClassSection,
  type CursorPageQuery,
  departmentByCode,
  ERROR_CODES,
  type EventAttendees,
  type EventInput,
  type EventList,
  type EventRangeQuery,
  type EventReviewPage,
  formatDateTime,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import { type Event as EventRow, Prisma, type User } from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';
import { ClubsService } from '../clubs/clubs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersService } from '../users/users.service.js';

export const EVENTS_RATE_LIMITS = {
  create: { name: 'events:create', limit: 20, windowSeconds: 60 * 60 },
  edit: { name: 'events:edit', limit: 60, windowSeconds: 60 * 60 },
  rsvp: { name: 'events:rsvp', limit: 60, windowSeconds: 60 * 60 },
  review: { name: 'events:review', limit: 120, windowSeconds: 15 * 60 },
} as const;

type ClassOf = NonNullable<Awaited<ReturnType<UsersService['classRepOf']>>>;

/** "CSE 2021, section A", for notifications. */
function classText(row: Pick<EventRow, 'classDepartment' | 'classSeries' | 'classSection'>) {
  if (!row.classDepartment || row.classSeries === null) return '';
  const department = departmentByCode(row.classDepartment, row.classSeries);
  const section = row.classSection ? `, section ${row.classSection}` : '';
  return `${department?.short ?? row.classDepartment} ${row.classSeries}${section}`;
}

/** The calendar returns at most this many events per request (a busy month, with room to spare). */
const RANGE_LIMIT = 300;
/** New events may start a little in the past (an event created as it begins), not days ago. */
const START_GRACE_MS = 60 * 60 * 1000;

const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Event not found.' });
const forbidden = (message: string) =>
  new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message });
const badRequest = (message: string) =>
  new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message });

function presentClass(row: EventRow): CampusEvent['class'] {
  if (!row.classDepartment || row.classSeries === null) return null;
  const department = departmentByCode(row.classDepartment, row.classSeries);
  return {
    department: department
      ? { code: department.code, short: department.short, name: department.name }
      : null,
    series: row.classSeries,
    // Written from a validated ClassSection when the event was created.
    section: row.classSection as ClassSection | null,
  };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly rateLimit: RateLimitService,
    /** Present only when the clubs module is switched on. */
    @Optional() private readonly clubs?: ClubsService,
    /** Present only when the notifications module is switched on. */
    @Optional() private readonly notifications?: NotificationsService,
    /** Class events: present only when users and admin are on (CR verification and reviews). */
    @Optional() private readonly users?: UsersService,
    @Optional() private readonly log?: ModerationLogService,
  ) {}

  /** Everything overlapping [from, to): a calendar month, or "upcoming" on a club page. */
  async range(viewerId: string, query: EventRangeQuery): Promise<EventList> {
    const rows = await this.prisma.event.findMany({
      where: {
        status: 'visible',
        review: 'approved',
        startsAt: { lt: new Date(query.to) },
        endsAt: { gt: new Date(query.from) },
        ...(query.clubId ? { clubId: query.clubId } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: RANGE_LIMIT,
    });
    return { items: await this.present(rows, viewerId) };
  }

  async get(viewerId: string, id: string): Promise<CampusEvent> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    const published = event.status === 'visible' && event.review === 'approved';
    if (!published && !(await this.canEdit(viewerId, event))) throw notFound();
    return this.presentOne(event, viewerId);
  }

  /** Staff: class events waiting for review, oldest first. */
  async reviewQueue(staffId: string, query: CursorPageQuery): Promise<EventReviewPage> {
    await this.requireStaff(staffId);
    const rows = await this.prisma.event.findMany({
      where: { review: 'pending', status: { not: 'removed' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.present(page, staffId),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  approve(staffId: string, id: string): Promise<CampusEvent> {
    return this.decide(staffId, id, 'approved', 'Approved for the calendar.');
  }

  reject(staffId: string, id: string, reason: string): Promise<CampusEvent> {
    return this.decide(staffId, id, 'rejected', reason);
  }

  async create(userId: string, input: EventInput): Promise<CampusEvent> {
    const user = await this.requireActive(userId);
    const classOf = input.forClass ? await this.requireClassRep(user) : null;
    if (!classOf) await this.requireOrganiser(user, input.clubId);
    if (Date.parse(input.startsAt) < Date.now() - START_GRACE_MS) {
      throw badRequest('The event cannot start in the past.');
    }
    await this.rateLimit.consume(EVENTS_RATE_LIMITS.create, userId);
    const event = await this.prisma.event.create({
      data: {
        title: input.title,
        category: input.category,
        description: input.description,
        venue: input.venue,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        clubId: classOf ? null : input.clubId,
        capacity: input.capacity,
        createdById: userId,
        // A CR's class event waits for a moderator before it reaches the calendar.
        ...(classOf
          ? {
              review: 'pending' as const,
              classDepartment: classOf.departmentCode,
              classSeries: classOf.series,
              classSection: classOf.section,
            }
          : {}),
      },
    });
    await this.media.attach(
      userId,
      'events.poster',
      event.id,
      input.posterId ? [input.posterId] : [],
    );
    return this.presentOne(event, userId);
  }

  async update(userId: string, id: string, input: EventInput): Promise<CampusEvent> {
    const user = await this.requireActive(userId);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    if (!(await this.canEdit(userId, event)))
      throw forbidden('Only the organisers can edit this event.');
    if (event.status === 'removed') throw forbidden('A moderator removed this event.');
    const isClass = event.classSeries !== null;
    if (input.forClass !== isClass) {
      throw badRequest('An event cannot switch between a class event and other events.');
    }
    // A CR's edit goes back to review, and only a current CR may make one. Staff edits stand.
    let backToReview = false;
    if (isClass) {
      if (!this.isStaffUser(user)) {
        await this.requireClassRep(user);
        backToReview = true;
      }
    } else if (input.clubId !== event.clubId) {
      // Moving it to another club needs the right to organise for that club too.
      await this.requireOrganiser(user, input.clubId);
    }
    await this.rateLimit.consume(EVENTS_RATE_LIMITS.edit, userId);

    const going = await this.prisma.eventRsvp.count({ where: { eventId: id } });
    if (input.capacity !== null && input.capacity < going) {
      throw badRequest(`${going} people are already going; the capacity cannot be lower.`);
    }
    // Worth telling the people going about; a new title or description is not.
    const moved =
      new Date(input.startsAt).getTime() !== event.startsAt.getTime() ||
      new Date(input.endsAt).getTime() !== event.endsAt.getTime() ||
      input.venue !== event.venue;
    await this.media.attach(userId, 'events.poster', id, input.posterId ? [input.posterId] : []);
    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: input.title,
        category: input.category,
        description: input.description,
        venue: input.venue,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        clubId: input.clubId,
        capacity: input.capacity,
        ...(backToReview ? { review: 'pending' as const, reviewNote: null } : {}),
      },
    });
    // Off the calendar until approved again; the approval tells the people going instead.
    if (moved && !updated.cancelledAt && !backToReview) {
      await this.notifyGoing(userId, updated, {
        type: 'events.changed',
        title: `${updated.title} has changed`,
        body: `Now ${formatDateTime(updated.startsAt)} at ${updated.venue}.`,
      });
    }
    return this.presentOne(updated, userId);
  }

  /** Cancelled events stay on the calendar, marked, so nobody turns up to an empty room. */
  async cancel(userId: string, id: string): Promise<CampusEvent> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    if (!(await this.canEdit(userId, event)))
      throw forbidden('Only the organisers can cancel this event.');
    if (event.cancelledAt) return this.presentOne(event, userId);
    const updated = await this.prisma.event.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
    await this.notifyGoing(userId, updated, {
      type: 'events.cancelled',
      title: `${updated.title} is cancelled`,
      body: `It was planned for ${formatDateTime(updated.startsAt)} at ${updated.venue}.`,
    });
    return this.presentOne(updated, userId);
  }

  async going(userId: string, id: string): Promise<CampusEvent> {
    await this.requireActive(userId);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event || event.status !== 'visible' || event.review !== 'approved') throw notFound();
    if (event.cancelledAt) throw badRequest('This event was cancelled.');
    if (event.endsAt.getTime() < Date.now()) throw badRequest('This event is over.');
    await this.rateLimit.consume(EVENTS_RATE_LIMITS.rsvp, userId);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Lock the event row: simultaneous taps for the last place queue up here, so the count
          // below cannot be stale. (A parameterised template, not string building.)
          await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR UPDATE`;
          const already = await tx.eventRsvp.findUnique({
            where: { eventId_userId: { eventId: id, userId } },
          });
          if (already) return;
          if (event.capacity !== null) {
            const count = await tx.eventRsvp.count({ where: { eventId: id } });
            if (count >= event.capacity) {
              throw new ConflictException({
                code: ERROR_CODES.CONFLICT,
                message: 'This event is full.',
              });
            }
          }
          await tx.eventRsvp.create({ data: { eventId: id, userId } });
        },
        // Taps for the same event wait for the lock in turn; the default 2 s is too short for that.
        { maxWait: 10_000, timeout: 10_000 },
      );
    } catch (error) {
      // A double tap on another server: the first request already saved it.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
    return this.presentOne(event, userId);
  }

  async notGoing(userId: string, id: string): Promise<CampusEvent> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    await this.prisma.eventRsvp.deleteMany({ where: { eventId: id, userId } });
    return this.presentOne(event, userId);
  }

  /** Who is going, for the organisers (to plan seats, food...). */
  async attendees(viewerId: string, id: string): Promise<EventAttendees> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    if (!(await this.canEdit(viewerId, event)))
      throw forbidden('Only the organisers can see who is going.');
    const rsvps = await this.prisma.eventRsvp.findMany({
      where: { eventId: id },
      orderBy: [{ createdAt: 'asc' }],
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rsvps.map((r) => r.userId) } },
      select: { id: true, name: true, roll: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rsvps.flatMap((r) => {
        const user = byId.get(r.userId);
        return user
          ? [{ id: user.id, name: user.name, roll: user.roll, since: r.createdAt.toISOString() }]
          : [];
      }),
    };
  }

  /** Tells everyone going, except the organiser who made the change. */
  private async notifyGoing(
    actorId: string,
    event: EventRow,
    input: { type: 'events.changed' | 'events.cancelled'; title: string; body: string },
  ) {
    if (!this.notifications) return;
    const going = await this.prisma.eventRsvp.findMany({ where: { eventId: event.id } });
    await this.notifications.notify(
      going.map((r) => r.userId).filter((id) => id !== actorId),
      { ...input, link: `/events/${event.id}` },
    );
  }

  // ----- rules -----

  private isStaffUser(user: Pick<User, 'role' | 'status'> | null): boolean {
    return (
      !!user && user.status === 'active' && (STAFF_ROLES as readonly string[]).includes(user.role)
    );
  }

  /** A staff decision on a waiting class event: logged, and the organiser is told. */
  private async decide(
    staffId: string,
    id: string,
    review: 'approved' | 'rejected',
    reason: string,
  ): Promise<CampusEvent> {
    await this.requireStaff(staffId);
    if (!this.log) throw forbidden('Event review is not available.');
    await this.rateLimit.consume(EVENTS_RATE_LIMITS.review, staffId);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event || event.review !== 'pending' || event.status === 'removed') throw notFound();
    if (event.createdById === staffId) {
      throw forbidden('Another staff member must review your event.');
    }
    const now = new Date();
    const [, updated] = await this.prisma.$transaction([
      this.log.record({
        moderatorId: staffId,
        action: review === 'approved' ? 'approve_content' : 'reject_content',
        contentType: 'events.event',
        contentId: id,
        targetUserId: event.createdById,
        reason,
      }),
      this.prisma.event.update({
        where: { id },
        data: {
          review,
          reviewNote: review === 'approved' ? null : reason,
          reviewedById: staffId,
          reviewedAt: now,
          ...(review === 'approved' && !event.approvedAt ? { approvedAt: now } : {}),
        },
      }),
    ]);
    const label = classText(updated);
    await this.notifications?.notify([event.createdById], {
      type: review === 'approved' ? 'events.approved' : 'events.rejected',
      title:
        review === 'approved'
          ? `${updated.title} is on the calendar`
          : `${updated.title} was not approved`,
      body:
        review === 'rejected'
          ? `Moderator's reason: ${reason}`
          : label
            ? `Class event for ${label}.`
            : null,
      link: `/events/${id}`,
    });
    // An edit that was approved again: the people going should look at it.
    if (review === 'approved' && event.approvedAt && !updated.cancelledAt) {
      await this.notifyGoing(event.createdById, updated, {
        type: 'events.changed',
        title: `${updated.title} was updated`,
        body: `Now ${formatDateTime(updated.startsAt)} at ${updated.venue}.`,
      });
    }
    return this.presentOne(updated, staffId);
  }

  /** Class events need a currently verified class representative (users module). */
  private async requireClassRep(user: User): Promise<ClassOf> {
    if (!this.users || !this.log) throw forbidden('Class events are not available.');
    const classOf = await this.users.classRepOf(user.id);
    if (!classOf) {
      throw forbidden('Only verified class representatives can create or edit class events.');
    }
    return classOf;
  }

  /** From the database, so a demoted moderator loses access at once. */
  private async requireStaff(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!this.isStaffUser(user)) throw forbidden('You do not have permission to do this.');
  }

  /** Staff organise anything; club managers organise for their own clubs. */
  private async requireOrganiser(user: User, clubId: string | null) {
    if (this.isStaffUser(user)) {
      if (clubId && !(await this.clubs?.refs([clubId]))?.has(clubId)) {
        throw badRequest('This club does not exist.');
      }
      return;
    }
    if (!clubId) throw forbidden('Only moderators and admins create campus-wide events.');
    if (!this.clubs || !(await this.clubs.isManager(user.id, clubId))) {
      throw forbidden('You can only create events for clubs you manage.');
    }
  }

  /** The organiser, the club's managers and staff. */
  private async canEdit(userId: string, event: EventRow): Promise<boolean> {
    if (event.createdById === userId) return true;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (this.isStaffUser(user)) return true;
    return !!event.clubId && !!this.clubs && (await this.clubs.isManager(userId, event.clubId));
  }

  /** Suspended and banned members cannot organise or RSVP (CLAUDE.md §7). */
  private async requireActive(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is suspended.',
      });
    }
    return user;
  }

  // ----- presentation -----

  private async presentOne(row: EventRow, viewerId: string): Promise<CampusEvent> {
    const [event] = await this.present([row], viewerId);
    return event!;
  }

  private async present(rows: EventRow[], viewerId: string): Promise<CampusEvent[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const clubIds = rows.flatMap((r) => (r.clubId ? [r.clubId] : []));
    const [organisers, posters, mine, counts, clubs, managed, viewer] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
        select: { id: true, name: true, role: true },
      }),
      this.media.forContent('events.poster', ids),
      this.prisma.eventRsvp.findMany({ where: { userId: viewerId, eventId: { in: ids } } }),
      this.prisma.eventRsvp.groupBy({
        by: ['eventId'],
        where: { eventId: { in: ids } },
        _count: { _all: true },
      }),
      this.clubs ? this.clubs.refs(clubIds) : new Map(),
      this.clubs ? this.clubs.managedAmong(viewerId, clubIds) : new Set<string>(),
      this.prisma.user.findUnique({ where: { id: viewerId } }),
    ]);
    const staff = this.isStaffUser(viewer);
    // Only asked when the viewer organised a class event here: may they still edit it?
    const viewerIsRep =
      !staff &&
      !!this.users &&
      rows.some((r) => r.classSeries !== null && r.createdById === viewerId) &&
      (await this.users.classRepOf(viewerId)) !== null;
    const byId = new Map(organisers.map((u) => [u.id, u]));
    const goingCounts = new Map(counts.map((c) => [c.eventId, c._count._all]));
    return rows.map((row) => {
      const going = goingCounts.get(row.id) ?? 0;
      const canEdit =
        staff || row.createdById === viewerId || (!!row.clubId && managed.has(row.clubId));
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        description: row.description,
        venue: row.venue,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        club: (row.clubId && clubs.get(row.clubId)) || null,
        class: presentClass(row),
        organiser: byId.get(row.createdById) ?? null,
        poster: posters.get(row.id)?.[0] ?? null,
        capacity: row.capacity,
        goingCount: going,
        isGoing: mine.some((r) => r.eventId === row.id),
        isFull: row.capacity !== null && going >= row.capacity,
        cancelled: row.cancelledAt !== null,
        moderated: row.status !== 'visible',
        canEdit: canEdit && row.status !== 'removed',
        canEditDetails:
          canEdit && row.status !== 'removed' && (row.classSeries === null || staff || viewerIsRep),
        review: row.review,
        reviewNote: canEdit ? row.reviewNote : null,
      };
    });
  }
}
