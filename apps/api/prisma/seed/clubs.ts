// Sample clubs, managed by the Demo Club Manager (already a club_manager in seed/users.ts).
// Clubs are matched by name, so re-running adds nothing. Runs after seed/news.ts.
import type { ClubCategory, PrismaClient } from '../../src/generated/prisma/client.js';
import { clubSlug } from '@ruet-chottor/shared';

const CLUBS: { name: string; category: ClubCategory; tagline: string; about: string }[] = [
  {
    name: 'Robotics Club (demo)',
    category: 'technical',
    tagline: 'Build robots and learn embedded systems together.',
    about:
      'Weekly hands-on workshops, line-follower and sumo-bot contests, and an annual project expo. Sample club for development.',
  },
  {
    name: 'Debating Club (demo)',
    category: 'cultural',
    tagline: 'Practise public speaking and British Parliamentary debate.',
    about:
      'Practice rounds every Saturday evening; beginners welcome. Sample club for development.',
  },
  {
    name: 'Blood Donation Volunteers (demo)',
    category: 'social_service',
    tagline: 'Connecting donors with patients in Rajshahi.',
    about:
      'We keep a volunteer donor list and run donation camps each term. Sample club for development.',
  },
];

export async function seedClubs(prisma: PrismaClient) {
  const byRoll = (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const manager = await byRoll('0000003'); // Demo Club Manager
  const admin = await byRoll('0000001');
  const student = await byRoll('1703999');
  const now = new Date();

  for (const club of CLUBS) {
    if (await prisma.club.findUnique({ where: { name: club.name } })) continue;
    await prisma.club.create({
      data: {
        ...club,
        slug: clubSlug(club.name),
        createdById: admin.id,
        memberships: {
          create: [{ userId: manager.id, role: 'manager', state: 'active', joinedAt: now }],
        },
      },
    });
  }

  // The Demo Student is a member of one club and waiting to join another.
  const robotics = await prisma.club.findUniqueOrThrow({ where: { name: CLUBS[0]!.name } });
  const debating = await prisma.club.findUniqueOrThrow({ where: { name: CLUBS[1]!.name } });
  for (const [clubId, state] of [
    [robotics.id, 'active'],
    [debating.id, 'pending'],
  ] as const) {
    await prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId, userId: student.id } },
      create: { clubId, userId: student.id, state, joinedAt: state === 'active' ? now : null },
      update: {},
    });
  }

  // The Demo Club Manager's robotics news post (seed/news.ts) was posted for this club.
  await prisma.newsPost.updateMany({
    where: { createdById: manager.id, title: { startsWith: 'Robotics club' }, clubId: null },
    data: { clubId: robotics.id },
  });
}
