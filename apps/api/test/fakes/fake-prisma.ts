import { randomUUID } from 'node:crypto';
import {
  type Conversation,
  type ConversationMember,
  type Message,
  type ModerationLog,
  Prisma,
  type Profile,
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
  if (expected === null || typeof expected !== 'object' || expected instanceof Date) {
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
    create: async ({ data }: { data: Partial<T> }) => insert(data),
    createMany: async ({ data }: { data: Partial<T>[] }) => {
      for (const item of data) insert(item);
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Where; data: Partial<T> }) =>
      Object.assign(one(where), data),
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

  /** Operations already ran when their promises were created; just wait for them. */
  async $transaction<T>(operations: Promise<T>[]) {
    return Promise.all(operations);
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
