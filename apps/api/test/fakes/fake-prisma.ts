import { randomUUID } from 'node:crypto';
import type { Profile, Session, User } from '../../src/generated/prisma/client.js';

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return (expected as Where[]).some((clause) => matches(row, clause));
    return row[key] === expected;
  });
}

/**
 * In-memory stand-in for the Prisma calls the auth and users modules make. Supports simple equality
 * filters only; add what a test needs, and prefer real-database tests for complex queries.
 */
export class FakePrisma {
  users: User[] = [];
  sessions: Session[] = [];
  profiles: Profile[] = [];

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

  async health() {
    return 'up' as const;
  }

  async $disconnect() {}
}
