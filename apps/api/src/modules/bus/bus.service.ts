import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type BusNotice,
  type BusNoticeInput,
  type BusNoticeList,
  type BusRoute,
  type BusRouteInput,
  type BusRouteList,
  clockToMinutes,
  dhakaDateKey,
  ERROR_CODES,
  minutesToClock,
} from '@ruet-chottor/shared';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import { type BusRoute as RouteRow, Prisma } from '../../generated/prisma/client.js';

export const BUS_RATE_LIMITS = {
  edit: { name: 'bus:edit', limit: 120, windowSeconds: 60 * 60 },
} as const;

const notFound = (what = 'Route') =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: `${what} not found.` });
const forbidden = () =>
  new ForbiddenException({
    code: ERROR_CODES.FORBIDDEN,
    message: 'Only admins can change the bus timetable.',
  });

/** A Dhaka calendar day as the DATE value Postgres stores. */
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

@Injectable()
export class BusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  // ----- reading (every member) -----

  /** Active routes; admins can ask for inactive ones too. */
  async routes(viewerId: string, all: boolean): Promise<BusRouteList> {
    if (all) await this.requireAdmin(viewerId);
    const rows = await this.prisma.busRoute.findMany({
      where: all ? {} : { active: true },
      orderBy: [{ name: 'asc' }],
    });
    return { items: await this.present(rows) };
  }

  async route(viewerId: string, id: string): Promise<BusRoute> {
    const row = await this.prisma.busRoute.findUnique({ where: { id } });
    if (!row) throw notFound();
    if (!row.active && !(await this.isAdmin(viewerId))) throw notFound();
    const [route] = await this.present([row]);
    return route!;
  }

  /** Notices in force today (Dhaka); admins can ask for all of them. */
  async notices(viewerId: string, all: boolean): Promise<BusNoticeList> {
    if (all) await this.requireAdmin(viewerId);
    const today = asDate(dhakaDateKey(new Date()));
    const rows = await this.prisma.busNotice.findMany({
      where: all ? {} : { startsOn: { lte: today }, endsOn: { gte: today } },
      orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
    });
    const routeIds = [...new Set(rows.flatMap((n) => (n.routeId ? [n.routeId] : [])))];
    const routes = routeIds.length
      ? await this.prisma.busRoute.findMany({ where: { id: { in: routeIds } } })
      : [];
    const byId = new Map(routes.map((r) => [r.id, { id: r.id, name: r.name, color: r.color }]));
    return {
      items: rows.map((n): BusNotice => ({
        id: n.id,
        route: n.routeId ? (byId.get(n.routeId) ?? null) : null,
        message: n.message,
        startsOn: n.startsOn.toISOString().slice(0, 10),
        endsOn: n.endsOn.toISOString().slice(0, 10),
      })),
    };
  }

  // ----- editing (admins) -----

  async create(adminId: string, input: BusRouteInput): Promise<BusRoute> {
    await this.requireAdmin(adminId);
    await this.rateLimit.consume(BUS_RATE_LIMITS.edit, adminId);
    const route = await this.unique(() =>
      this.prisma.busRoute.create({
        data: {
          name: input.name,
          description: input.description,
          color: input.color,
          active: input.active,
        },
      }),
    );
    await this.prisma.$transaction(this.writeChildren(route.id, input));
    return this.route(adminId, route.id);
  }

  /** Replaces the route's details, stops and trips in one go (the editor saves the whole route). */
  async replace(adminId: string, id: string, input: BusRouteInput): Promise<BusRoute> {
    await this.requireAdmin(adminId);
    const existing = await this.prisma.busRoute.findUnique({ where: { id } });
    if (!existing) throw notFound();
    await this.rateLimit.consume(BUS_RATE_LIMITS.edit, adminId);
    await this.unique(() =>
      this.prisma.$transaction([
        this.prisma.busRoute.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            color: input.color,
            active: input.active,
          },
        }),
        this.prisma.busStop.deleteMany({ where: { routeId: id } }),
        this.prisma.busTrip.deleteMany({ where: { routeId: id } }),
        ...this.writeChildren(id, input),
      ]),
    );
    return this.route(adminId, id);
  }

  async remove(adminId: string, id: string): Promise<void> {
    await this.requireAdmin(adminId);
    if (!(await this.prisma.busRoute.findUnique({ where: { id } }))) throw notFound();
    await this.prisma.busRoute.delete({ where: { id } });
  }

  async createNotice(adminId: string, input: BusNoticeInput): Promise<BusNotice> {
    await this.requireAdmin(adminId);
    await this.rateLimit.consume(BUS_RATE_LIMITS.edit, adminId);
    if (
      input.routeId &&
      !(await this.prisma.busRoute.findUnique({ where: { id: input.routeId } }))
    ) {
      throw notFound();
    }
    const notice = await this.prisma.busNotice.create({
      data: {
        routeId: input.routeId,
        message: input.message,
        startsOn: asDate(input.startsOn),
        endsOn: asDate(input.endsOn),
        createdById: adminId,
      },
    });
    const { items } = await this.notices(adminId, true);
    return items.find((n) => n.id === notice.id)!;
  }

  async removeNotice(adminId: string, id: string): Promise<void> {
    await this.requireAdmin(adminId);
    if (!(await this.prisma.busNotice.findUnique({ where: { id } }))) throw notFound('Notice');
    await this.prisma.busNotice.delete({ where: { id } });
  }

  // ----- helpers -----

  private writeChildren(routeId: string, input: BusRouteInput) {
    return [
      this.prisma.busStop.createMany({
        data: input.stops.map((stop, position) => ({
          routeId,
          name: stop.name,
          position,
          minutesFromCampus: stop.minutesFromCampus,
        })),
      }),
      this.prisma.busTrip.createMany({
        data: input.trips.map((trip) => ({
          routeId,
          direction: trip.direction,
          departMinutes: clockToMinutes(trip.departsAt),
          days: [...trip.days].sort(),
          note: trip.note,
        })),
      }),
    ];
  }

  /** Route names are unique. */
  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.CONFLICT,
          message: 'A route with this name already exists.',
        });
      }
      throw error;
    }
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.status === 'active' && user.role === 'admin';
  }

  /** From the database, so a demoted admin loses access at once. */
  private async requireAdmin(userId: string) {
    if (!(await this.isAdmin(userId))) throw forbidden();
  }

  private async present(rows: RouteRow[]): Promise<BusRoute[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [stops, trips] = await Promise.all([
      this.prisma.busStop.findMany({
        where: { routeId: { in: ids } },
        orderBy: [{ position: 'asc' }],
      }),
      this.prisma.busTrip.findMany({
        where: { routeId: { in: ids } },
        orderBy: [{ departMinutes: 'asc' }],
      }),
    ]);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      active: row.active,
      stops: stops
        .filter((s) => s.routeId === row.id)
        .map((s) => ({ id: s.id, name: s.name, minutesFromCampus: s.minutesFromCampus })),
      trips: trips
        .filter((t) => t.routeId === row.id)
        .map((t) => ({
          id: t.id,
          direction: t.direction,
          departsAt: minutesToClock(t.departMinutes),
          days: t.days,
          note: t.note,
        })),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
