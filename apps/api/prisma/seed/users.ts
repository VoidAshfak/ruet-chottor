// Demo accounts and fake members. Every person here is made up: emails are @example.com and
// phone numbers sit in the unused +880170000XXXX range. Rolls follow the real format
// (series + department code + serial) with serials in the 9xx range.
// A fixed list instead of a random generator keeps the seed deterministic without a new dependency.
import argon2 from 'argon2';
import type { PrismaClient, Role } from '../../src/generated/prisma/client.js';

/** Documented in docs/getting-started.md. Development only. */
export const DEMO_PASSWORD = 'Password123!';

type FakePerson = {
  name: string;
  roll: string;
  role: Role;
  showEmail?: boolean;
  showPhone?: boolean;
  status?: 'active' | 'suspended' | 'banned';
};

const PEOPLE: FakePerson[] = [
  // Fixed demo accounts, one per role.
  { name: 'Demo Admin', roll: '0000001', role: 'admin', showEmail: true },
  { name: 'Demo Moderator', roll: '0000002', role: 'moderator', showEmail: true },
  { name: 'Demo Club Manager', roll: '0000003', role: 'club_manager', showEmail: true },
  { name: 'Demo Teacher', roll: '0000004', role: 'teacher', showEmail: true, showPhone: true },
  { name: 'Demo Student', roll: '1703999', role: 'student' },
  { name: 'Demo Alumni', roll: '1201999', role: 'alumni', showEmail: true },
  // Fake members across departments and series, with mixed privacy choices.
  { name: 'Rafiq Fakeuddin', roll: '2103901', role: 'student', showEmail: true },
  { name: 'Nusrat Example', roll: '2101902', role: 'student', showPhone: true },
  { name: 'Tanvir Testman', roll: '2200903', role: 'student' },
  { name: 'Sadia Sample', roll: '2202904', role: 'student', showEmail: true, showPhone: true },
  { name: 'Arif Placeholder', roll: '1908905', role: 'student' },
  { name: 'Mim Dummy', roll: '2010906', role: 'student', showEmail: true },
  { name: 'Hasan Mockrahman', roll: '1804907', role: 'alumni', showEmail: true },
  { name: 'Suspended Sample', roll: '2103908', role: 'student', status: 'suspended' },
];

export async function seedUsers(prisma: PrismaClient) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const [index, person] of PEOPLE.entries()) {
    const n = String(index + 1).padStart(4, '0');
    const local = person.name.toLowerCase().replace(/[^a-z]+/g, '.');
    const account = {
      name: person.name,
      registrationNo: `99${n}`,
      email: `${local}@example.com`,
      phone: `+880170000${n}`,
      dateOfBirth: new Date('2000-01-01T00:00:00Z'),
      role: person.role,
      status: person.status ?? 'active',
    };
    const user = await prisma.user.upsert({
      where: { roll: person.roll },
      create: { ...account, roll: person.roll, passwordHash },
      update: account,
    });
    const settings = {
      showEmail: person.showEmail ?? false,
      showPhone: person.showPhone ?? false,
    };
    await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...settings },
      update: settings,
    });
  }
}

/**
 * Class representative demo: one verified CR and one request waiting in the admin panel. Demo
 * Student has none, so the "ask to be verified" flow can be tried. Re-running replaces these rows.
 */
export async function seedClassReps(prisma: PrismaClient) {
  const byRoll = (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const moderator = await byRoll('0000002');
  const verified = await byRoll('2103901');
  const waiting = await byRoll('2202904');
  await prisma.classRepRequest.deleteMany({ where: { userId: { in: [verified.id, waiting.id] } } });
  await prisma.classRepRequest.create({
    data: {
      userId: verified.id,
      section: 'A',
      note: 'Chosen by CSE 2021 section A in the first week of term. The class adviser can confirm.',
      status: 'approved',
      reviewedById: moderator.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.classRepRequest.create({
    data: {
      userId: waiting.id,
      section: 'B',
      note: 'Elected CR of ME 2022 section B last month. Ask anyone in our section.',
    },
  });
}
