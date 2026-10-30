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
  ERROR_CODES,
  type EventAttendees,
  type EventInput,
  type EventList,
  type EventRangeQuery,
  STAFF_ROLES,
} from '@ruet-chottor/shared';
import { MediaService } from '../../core/media/media.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import { type Event as EventRow, Prisma, type User } from '../../generated/prisma/client.js';
import { ClubsService } from '../clubs/clubs.service.js';

export const EVENTS_RATE_LIMITS = {
  create: { name: 'events:create', limit: 20, windowSeconds: 60 * 60 },
  edit: { name: 'events:edit', limit: 60, windowSeconds: 60 * 60 },
  rsvp: { name: 'events:rsvp', limit: 60, windowSeconds: 60 * 60 },
} as const;

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

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly rateLimit: RateLimitService,
    /** Present only when the clubs module is switched on. */
    @Optional() private readonly clubs?: ClubsService,
  ) {}

  /** Everything overlapping [from, to): a calendar month, or "upcoming" on a club page. */
  async range(viewerId: string, query: EventRangeQuery): Promise<EventList> {
    const rows = await this.prisma.event.findMany({
      where: {
        status: 'visible',
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
    if (event.status !== 'visible' && !(await this.canEdit(viewerId, event))) throw notFound();
    return this.presentOne(event, viewerId);
  }

  async create(userId: string, input: EventInput): Promise<CampusEvent> {
    const user = await this.requireActive(userId);
    await this.requireOrganiser(user, input.clubId);
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
        clubId: input.clubId,
        capacity: input.capacity,
        createdById: userId,
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
    // Moving it to another club needs the right to organise for that club too.
    if (input.clubId !== event.clubId) await this.requireOrganiser(user, input.clubId);
    await this.rateLimit.consume(EVENTS_RATE_LIMITS.edit, userId);

    const going = await this.prisma.eventRsvp.count({ where: { eventId: id } });
    if (input.capacity !== null && input.capacity < going) {
      throw badRequest(`${going} people are already going; the capacity cannot be lower.`);
    }
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
      },
    });
    return this.presentOne(updated, userId);
  }

  /** Cancelled events stay on the calendar, marked, so nobody turns up to an empty room. */
  async cancel(userId: string, id: string): Promise<CampusEvent> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw notFound();
    if (!(await this.canEdit(userId, event)))
      throw forbidden('Only the organisers can cancel this event.');
    const updated = event.cancelledAt
      ? event
      : await this.prisma.event.update({ where: { id }, data: { cancelledAt: new Date() } });
    return this.presentOne(updated, userId);
  }

  async going(userId: string, id: string): Promise<CampusEvent> {
    await this.requireActive(userId);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event || event.status !== 'visible') throw notFound();
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

  // ----- rules -----

  private isStaffUser(user: Pick<User, 'role' | 'status'> | null): boolean {
    return (
      !!user && user.status === 'active' && (STAFF_ROLES as readonly string[]).includes(user.role)
    );
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
    const [organisers, posters, mine, counts, clubs, viewer] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
        select: { id: true, name: true, role: true },
      }),
      this.media.forContent('events.poster', ids),
      this.prisma.eventRsvp.findMany({ where: { userId: viewerId, eventId: { in: ids } } }),
      Promise.all(ids.map((eventId) => this.prisma.eventRsvp.count({ where: { eventId } }))),
      this.clubs ? this.clubs.refs(rows.flatMap((r) => (r.clubId ? [r.clubId] : []))) : new Map(),
      this.prisma.user.findUnique({ where: { id: viewerId } }),
    ]);
    const staff = this.isStaffUser(viewer);
    const byId = new Map(organisers.map((u) => [u.id, u]));
    return Promise.all(
      rows.map(async (row, index) => {
        const going = counts[index] ?? 0;
        const canEdit =
          staff ||
          row.createdById === viewerId ||
          (!!row.clubId && !!this.clubs && (await this.clubs.isManager(viewerId, row.clubId)));
        return {
          id: row.id,
          title: row.title,
          category: row.category,
          description: row.description,
          venue: row.venue,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          club: (row.clubId && clubs.get(row.clubId)) || null,
          organiser: byId.get(row.createdById) ?? null,
          poster: posters.get(row.id)?.[0] ?? null,
          capacity: row.capacity,
          goingCount: going,
          isGoing: mine.some((r) => r.eventId === row.id),
          isFull: row.capacity !== null && going >= row.capacity,
          cancelled: row.cancelledAt !== null,
          moderated: row.status !== 'visible',
          canEdit: canEdit && row.status !== 'removed',
        };
      }),
    );
  }
}
