// Sample lost & found posts (text only: no Cloudinary files). Matched by title, so re-running adds
// nothing. Expiry is counted from the seed run, so the posts stay on the board for 30 days.
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedLostFound(prisma: PrismaClient) {
  const byRoll = (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const student = await byRoll('1703999'); // Demo Student
  const rafiq = await byRoll('2103901');
  const sadia = await byRoll('2202904');
  const day = (daysAgo: number) =>
    new Date(`${new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10)}T00:00:00Z`);

  const items = [
    {
      createdById: student.id,
      kind: 'lost' as const,
      category: 'id_card' as const,
      title: 'Student ID card (demo)',
      description:
        'Blue lanyard. Probably dropped between the cafeteria and the library. (Sample post.)',
      place: 'cafeteria' as const,
      placeDetail: null,
      happenedOn: day(1),
      verifyQuestion: null,
    },
    {
      createdById: rafiq.id,
      kind: 'found' as const,
      category: 'phone' as const,
      title: 'Black phone in a blue case (demo)',
      description:
        'Found on a bench, switched off. Message me with the answer below. (Sample post.)',
      place: 'central_library' as const,
      placeDetail: 'Second floor reading room',
      happenedOn: day(2),
      verifyQuestion: 'What is the lock-screen photo?',
    },
    {
      createdById: sadia.id,
      kind: 'found' as const,
      category: 'keys' as const,
      title: 'Bunch of keys with a red keyring (demo)',
      description: 'Three keys on a red ring. (Sample post.)',
      place: 'bus' as const,
      placeDetail: 'Route 2 evening bus',
      happenedOn: day(3),
      verifyQuestion: 'How many keys, and what is on the keyring?',
    },
  ];

  for (const item of items) {
    if (await prisma.lostFoundItem.findFirst({ where: { title: item.title } })) continue;
    await prisma.lostFoundItem.create({
      data: { ...item, expiresAt: new Date(Date.now() + 30 * DAY_MS) },
    });
  }
}
