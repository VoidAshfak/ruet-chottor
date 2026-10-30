import { randomUUID } from 'node:crypto';
import {
  type BusNotice,
  type BusRoute,
  type BusStop,
  type BusTrip,
  type Club,
  type ClubMembership,
  type Conversation,
  type Event,
  type EventRsvp,
  type ConversationMember,
  type Listing,
  type LostFoundItem,
  type MediaAsset,
  type Message,
  type ModerationLog,
  type NewsPost,
  Prisma,
  type Profile,
  type Report,
  type Session,
  type User,
} from '../../src/generated/prisma/client.js';

type Where = Record<string, unknown>;

type Filter = {
  startsWith?: string;
  contains?: string;
  mode?: 'insensitive';
  in?: unknown[];
  not?: unknown;
  gt?: Date | number;
  gte?: Date | number;
  lt?: Date | number;
  lte?: Date | number;
};

const FILTER_KEYS = ['startsWith', 'contains', 'mode', 'in', 'not', 'gt', 'gte', 'lt', 'lte'];
const isFilter = (value: object) => Object.keys(value).some((key) => FILTER_KEYS.includes(key));
const num = (value: unknown) => (value instanceof Date ? value.getTime() : Number(value));

function matchesValue(value: unknown, expected: unknown): boolean {
  // Like Prisma: an undefined filter is ignored, and dates compare by value.
  if (expected === undefined) return true;
  if (expected instanceof Date)
    return value instanceof Date && value.getTime() === expected.getTime();
  if (expected === null || typeof expected !== 'object') {
    return value === expected;
  }
  const filter = expected as Filter;
  if (filter.in !== undefined) return filter.in.includes(value);
  if ('not' in filter) return !matchesValue(value, filter.not);
  if (filter.gt !== undefined && !(num(value) > num(filter.gt))) return false;
  if (filter.gte !== undefined && !(num(value) >= num(filter.gte))) return false;
  if (filter.lt !== undefined && !(num(value) < num(filter.lt))) return false;
  if (filter.lte !== undefined && !(num(value) <= num(filter.lte))) return false;
  if (filter.startsWith === undefined && filter.contains === undefined) return true;
  const fold = (text: string) => (filter.mode === 'insensitive' ? text.toLowerCase() : text);
  const text = fold(String(value));
  if (filter.startsWith !== undefined && !text.startsWith(fold(filter.startsWith))) return false;
  if (filter.contains !== undefined && !text.includes(fold(filter.contains))) return false;
  return true;
}

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return (expected as Where[]).some((clause) => matches(row, clause));
    if (key === 'AND') return (expected as Where[]).every((clause) => matches(row, clause));
    // Compound unique keys, e.g. `conversationId_userId: { conversationId, userId }`.
    if (!(key in row) && typeof expected === 'object' && expected && !isFilter(expected)) {
      return matches(row, expected as Where);
    }
    return matchesValue(row[key], expected);
  });
}

type OrderBy = Record<string, 'asc' | 'desc'>[];

function sortRows<T>(rows: T[], orderBy: OrderBy = []): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const clause of orderBy) {
        const [field, direction] = Object.entries(clause)[0]!;
        const x = (a.row as Record<string, unknown>)[field];
        const y = (b.row as Record<string, unknown>)[field];
        const diff =
          x instanceof Date || typeof x === 'number'
            ? num(x) - num(y)
            : String(x).localeCompare(String(y));
        if (diff !== 0) return direction === 'asc' ? diff : -diff;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/** A generic table: enough of the Prisma model API for the chat module. */
function table<T extends object>(rows: () => T[], defaults: () => Partial<T>) {
  const find = (where: Where = {}) =>
    rows().filter((row) => matches(row as unknown as Where, where));
  const one = (where: Where) => {
    const row = find(where)[0];
    if (!row) throw new Error('Record not found');
    return row;
  };
  const insert = (data: Partial<T>) => {
    const row = { ...defaults(), ...data } as T;
    rows().push(row);
    return row;
  };
  return {
    insert,
    findUnique: async ({ where }: { where: Where }) => find(where)[0] ?? null,
    findFirst: async ({ where, orderBy }: { where?: Where; orderBy?: OrderBy }) =>
      sortRows(find(where), orderBy)[0] ?? null,
    findMany: async (args: {
      where?: Where;
      orderBy?: OrderBy;
      take?: number;
      skip?: number;
      cursor?: { id: string };
    }) => {
      const sorted = sortRows(find(args.where), args.orderBy);
      const start = args.cursor
        ? sorted.findIndex((row) => (row as { id?: string }).id === args.cursor?.id)
        : 0;
      if (start === -1) return [];
      return sorted.slice(start + (args.skip ?? 0)).slice(0, args.take);
    },
    count: async ({ where }: { where?: Where }) => find(where).length,
    // Only the shape the services use: grouped by one field, counting rows.
    groupBy: async ({ by, where }: { by: [keyof T & string]; where?: Where }) => {
      const counts = new Map<unknown, number>();
      for (const row of find(where)) {
        const value = (row as Record<string, unknown>)[by[0]];
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return [...counts].map(([value, count]) => ({ [by[0]]: value, _count: { _all: count } }));
    },
    create: async ({ data }: { data: Partial<T> }) => insert(data),
    createMany: async ({ data }: { data: Partial<T>[] }) => {
      for (const item of data) insert(item);
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Where; data: Partial<T> }) =>
      Object.assign(one(where), data),
    updateMany: async ({ where, data }: { where: Where; data: Partial<T> }) => {
      const matched = find(where);
      for (const row of matched) Object.assign(row, data);
      return { count: matched.length };
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: Where;
      create: Partial<T>;
      update: Partial<T>;
    }) => {
      const existing = find(where)[0];
      return existing ? Object.assign(existing, update) : insert(create);
    },
    delete: async ({ where }: { where: Where }) => {
      const row = one(where);
      rows().splice(rows().indexOf(row), 1);
      return row;
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const matched = find(where);
      for (const row of matched) rows().splice(rows().indexOf(row), 1);
      return { count: matched.length };
    },
  };
}

/**
 * In-memory stand-in for the Prisma calls the auth, users and directory modules make. Supports
 * equality, AND/OR and startsWith/contains filters; add what a test needs, and prefer
 * real-database tests for complex queries.
 */
export class FakePrisma {
  users: User[] = [];
  sessions: Session[] = [];
  profiles: Profile[] = [];
  moderationLogs: ModerationLog[] = [];
  conversations: Conversation[] = [];
  conversationMembers: ConversationMember[] = [];
  messages: Message[] = [];
  reports: Report[] = [];
  mediaAssets: MediaAsset[] = [];
  newsPosts: NewsPost[] = [];
  clubs: Club[] = [];
  clubMemberships: ClubMembership[] = [];
  events: Event[] = [];
  eventRsvps: EventRsvp[] = [];
  lostFoundItems: LostFoundItem[] = [];
  listings: Listing[] = [];
  busRoutes: BusRoute[] = [];
  busStops: BusStop[] = [];
  busTrips: BusTrip[] = [];
  busNotices: BusNotice[] = [];

  private withProfile(user: User | undefined, args: { select?: Where; include?: Where }) {
    if (!user) return null;
    if (!args.select?.profile && !args.include?.profile) return user;
    return { ...user, profile: this.profiles.find((p) => p.userId === user.id) ?? null };
  }

  user = {
    findFirst: async ({ where }: { where: Where }) =>
      this.users.find((u) => matches(u as unknown as Where, where)) ?? null,
    findUnique: async (args: { where: Where; select?: Where; include?: Where }) =>
      this.withProfile(
        this.users.find((u) => matches(u as unknown as Where, args.where)),
        args,
      ),
    /** Sorted by name then id, like the directory's `orderBy`. */
    findMany: async (args: {
      where: Where;
      select?: Where;
      take?: number;
      skip?: number;
      cursor?: { id: string };
    }) => {
      const sorted = this.users
        .filter((u) => matches(u as unknown as Where, args.where))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const start = args.cursor ? sorted.findIndex((u) => u.id === args.cursor?.id) : 0;
      return sorted
        .slice(start + (args.skip ?? 0))
        .slice(0, args.take)
        .map((u) => this.withProfile(u, args));
    },
    create: async ({ data }: { data: Partial<User> }) => {
      const now = new Date();
      const user = {
        id: randomUUID(),
        role: 'student',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        ...data,
      } as User;
      this.users.push(user);
      return user;
    },
    update: async ({ where, data }: { where: Where; data: Partial<User> }) => {
      const user = this.users.find((u) => matches(u as unknown as Where, where));
      if (!user) throw new Error('Record not found');
      Object.assign(user, data);
      return user;
    },
  };

  session = {
    findMany: async ({ where }: { where: Where }) =>
      this.sessions.filter((s) => matches(s as unknown as Where, where)),
    create: async ({ data }: { data: Partial<Session> }) => {
      const now = new Date();
      const session = {
        id: randomUUID(),
        previousRefreshTokenHash: null,
        userAgent: null,
        revokedAt: null,
        createdAt: now,
        lastUsedAt: now,
        ...data,
      } as Session;
      this.sessions.push(session);
      return session;
    },
    findUnique: async ({ where, include }: { where: Where; include?: { user?: boolean } }) => {
      const session = this.sessions.find((s) => matches(s as unknown as Where, where));
      if (!session) return null;
      return include?.user
        ? { ...session, user: this.users.find((u) => u.id === session.userId) }
        : session;
    },
    update: async ({ where, data }: { where: Where; data: Partial<Session> }) => {
      const session = this.sessions.find((s) => matches(s as unknown as Where, where));
      if (!session) throw new Error('Record not found');
      Object.assign(session, data);
      return session;
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Session> }) => {
      const rows = this.sessions.filter((s) => matches(s as unknown as Where, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
  };

  profile = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: Partial<Profile> & { userId: string };
      update: Partial<Profile>;
    }) => {
      const existing = this.profiles.find((p) => p.userId === where.userId);
      if (existing) return Object.assign(existing, update, { updatedAt: new Date() });
      const profile = {
        showEmail: false,
        showPhone: false,
        dismissedGuides: [],
        updatedAt: new Date(),
        ...create,
      } as Profile;
      this.profiles.push(profile);
      return profile;
    },
  };

  /** Append-only, like the real table (a trigger refuses UPDATE and DELETE). */
  moderationLog = {
    create: async ({ data }: { data: Partial<ModerationLog> }) => {
      const row = {
        id: randomUUID(),
        targetUserId: null,
        contentType: null,
        contentId: null,
        details: null,
        createdAt: new Date(),
        ...data,
      } as ModerationLog;
      this.moderationLogs.push(row);
      return row;
    },
    /** Newest first, like the log's `orderBy`. */
    findMany: async (args: {
      where?: Where;
      take?: number;
      skip?: number;
      cursor?: { id: string };
    }) => {
      const sorted = this.moderationLogs
        .filter((row) => matches(row as unknown as Where, args.where ?? {}))
        .map((row, index) => ({ row, index }))
        // Insertion order breaks ties between rows created in the same millisecond.
        .sort((a, b) => b.row.createdAt.getTime() - a.row.createdAt.getTime() || b.index - a.index)
        .map(({ row }) => row);
      const start = args.cursor ? sorted.findIndex((row) => row.id === args.cursor?.id) : 0;
      return sorted.slice(start + (args.skip ?? 0)).slice(0, args.take);
    },
  };

  private readonly members = table<ConversationMember>(
    () => this.conversationMembers,
    () => {
      const now = new Date();
      return { role: 'member', lastReadAt: now, joinedAt: now, leftAt: null };
    },
  );

  conversationMember = this.members;

  private readonly conversationTable = table<Conversation>(
    () => this.conversations,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        name: null,
        directKey: null,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  conversation = {
    ...this.conversationTable,
    /** Supports nested `members: { create: [...] }` and the unique `directKey`. */
    create: async ({
      data,
    }: {
      data: Partial<Conversation> & { members?: { create: Partial<ConversationMember>[] } };
    }) => {
      const { members, ...fields } = data;
      if (fields.directKey && this.conversations.some((c) => c.directKey === fields.directKey)) {
        throw uniqueViolation();
      }
      const conversation = this.conversationTable.insert(fields);
      for (const member of members?.create ?? []) {
        this.members.insert({ ...member, conversationId: conversation.id });
      }
      return conversation;
    },
  };

  message = table<Message>(
    () => this.messages,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        status: 'visible',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  private readonly busRouteTable = table<BusRoute>(
    () => this.busRoutes,
    () => {
      const now = new Date();
      return { id: randomUUID(), description: '', active: true, createdAt: now, updatedAt: now };
    },
  );

  busRoute = {
    ...this.busRouteTable,
    /** Unique names; deleting a route deletes its stops, trips and notices (cascade). */
    create: async ({ data }: { data: Partial<BusRoute> }) => {
      if (this.busRoutes.some((r) => r.name === data.name)) throw uniqueViolation();
      return this.busRouteTable.insert(data);
    },
    update: async ({ where, data }: { where: Where; data: Partial<BusRoute> }) => {
      const route = (await this.busRouteTable.findUnique({ where }))!;
      if (data.name && this.busRoutes.some((r) => r !== route && r.name === data.name)) {
        throw uniqueViolation();
      }
      return this.busRouteTable.update({ where, data });
    },
    delete: async ({ where }: { where: Where }) => {
      const route = await this.busRouteTable.delete({ where });
      this.busStops = this.busStops.filter((s) => s.routeId !== route.id);
      this.busTrips = this.busTrips.filter((t) => t.routeId !== route.id);
      this.busNotices = this.busNotices.filter((n) => n.routeId !== route.id);
      return route;
    },
  };

  busStop = table<BusStop>(
    () => this.busStops,
    () => ({ id: randomUUID() }),
  );

  busTrip = table<BusTrip>(
    () => this.busTrips,
    () => ({ id: randomUUID(), note: null }),
  );

  busNotice = table<BusNotice>(
    () => this.busNotices,
    () => ({ id: randomUUID(), routeId: null, createdAt: new Date() }),
  );

  listing = table<Listing>(
    () => this.listings,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        description: '',
        meetDetail: null,
        state: 'available',
        status: 'visible',
        heldTerm: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  lostFoundItem = table<LostFoundItem>(
    () => this.lostFoundItems,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        description: '',
        placeDetail: null,
        verifyQuestion: null,
        state: 'open',
        status: 'visible',
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  event = table<Event>(
    () => this.events,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        description: '',
        clubId: null,
        capacity: null,
        status: 'visible',
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  eventRsvp = (() => {
    const base = table<EventRsvp>(
      () => this.eventRsvps,
      () => ({ createdAt: new Date() }),
    );
    return {
      ...base,
      create: async ({ data }: { data: Partial<EventRsvp> }) => {
        if (this.eventRsvps.some((r) => r.eventId === data.eventId && r.userId === data.userId)) {
          throw uniqueViolation();
        }
        return base.insert(data);
      },
    };
  })();

  clubMembership = (() => {
    const base = table<ClubMembership>(
      () => this.clubMemberships,
      () => ({ role: 'member', state: 'pending', requestedAt: new Date(), joinedAt: null }),
    );
    return {
      ...base,
      create: async ({ data }: { data: Partial<ClubMembership> }) => {
        const taken = this.clubMemberships.some(
          (m) => m.clubId === data.clubId && m.userId === data.userId,
        );
        if (taken) throw uniqueViolation();
        return base.insert(data);
      },
    };
  })();

  private readonly clubTable = table<Club>(
    () => this.clubs,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        about: '',
        contactEmail: null,
        links: [],
        status: 'visible',
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  club = {
    ...this.clubTable,
    /** Unique name and slug, and nested `memberships: { create: [...] }`. */
    create: async ({
      data,
    }: {
      data: Partial<Club> & { memberships?: { create: Partial<ClubMembership>[] } };
    }) => {
      const { memberships, ...fields } = data;
      if (this.clubs.some((c) => c.name === fields.name || c.slug === fields.slug)) {
        throw uniqueViolation();
      }
      const club = this.clubTable.insert(fields);
      for (const m of memberships?.create ?? [])
        this.clubMembership.insert({ ...m, clubId: club.id });
      return club;
    },
    update: async ({ where, data }: { where: Where; data: Partial<Club> }) => {
      const club = (await this.clubTable.findUnique({ where }))!;
      const clash = this.clubs.some(
        (c) =>
          c !== club &&
          ((data.name && c.name === data.name) || (data.slug && c.slug === data.slug)),
      );
      if (clash) throw uniqueViolation();
      return this.clubTable.update({ where, data });
    },
  };

  newsPost = table<NewsPost>(
    () => this.newsPosts,
    () => {
      const now = new Date();
      return {
        id: randomUUID(),
        review: 'pending',
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
        status: 'visible',
        publishedAt: null,
        clubId: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  );

  mediaAsset = table<MediaAsset>(
    () => this.mediaAssets,
    () => ({
      status: 'pending',
      format: null,
      bytes: null,
      width: null,
      height: null,
      contentId: null,
      position: 0,
      createdAt: new Date(),
      attachedAt: null,
    }),
  );

  private readonly reportTable = table<Report>(
    () => this.reports,
    () => ({
      id: randomUUID(),
      note: null,
      status: 'open',
      resolvedById: null,
      resolvedAt: null,
      createdAt: new Date(),
    }),
  );

  report = {
    ...this.reportTable,
    /** Enforces the one-report-per-person-per-item unique key. */
    create: async ({ data }: { data: Partial<Report> }) => {
      const duplicate = this.reports.some(
        (r) =>
          r.contentType === data.contentType &&
          r.contentId === data.contentId &&
          r.reporterId === data.reporterId,
      );
      if (duplicate) throw uniqueViolation();
      return this.reportTable.insert(data);
    },
  };

  /** Operations already ran when their promises were created; just wait for them. */
  async $transaction<T>(operations: Promise<T>[] | ((tx: this) => Promise<T>)) {
    // Interactive form: one process, so running the callback against this fake is already atomic.
    if (typeof operations === 'function') return operations(this);
    return Promise.all(operations);
  }

  /** Row locks (`SELECT ... FOR UPDATE`) need no work in a single-process fake. */
  async $queryRaw() {
    return [];
  }

  async health() {
    return 'up' as const;
  }

  async $disconnect() {}
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'fake',
  });
}
