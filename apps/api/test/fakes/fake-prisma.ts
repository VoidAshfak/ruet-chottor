import { randomUUID } from 'node:crypto';
import type { ModerationLog, Profile, Session, User } from '../../src/generated/prisma/client.js';

type Where = Record<string, unknown>;

type StringFilter = {
  startsWith?: string;
  contains?: string;
  mode?: 'insensitive';
  in?: unknown[];
};

function matchesValue(value: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object' || expected instanceof Date) {
    return value === expected;
  }
  const filter = expected as StringFilter;
  if (filter.in !== undefined) return filter.in.includes(value);
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
    return matchesValue(row[key], expected);
  });
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

  /** Operations already ran when their promises were created; just wait for them. */
  async $transaction<T>(operations: Promise<T>[]) {
    return Promise.all(operations);
  }

  async health() {
    return 'up' as const;
  }

  async $disconnect() {}
}
