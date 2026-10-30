// Sample marketplace listings (text only: no Cloudinary files). Matched by title, so re-running adds
// nothing. Expiry is counted from the seed run, so they stay up for 30 days.
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedMarketplace(prisma: PrismaClient) {
  const byRoll = (roll: string) => prisma.user.findUniqueOrThrow({ where: { roll } });
  const student = await byRoll('1703999'); // Demo Student
  const rafiq = await byRoll('2103901');
  const mim = await byRoll('2010906');

  const listings = [
    {
      createdById: rafiq.id,
      title: 'Casio fx-991EX calculator (demo)',
      category: 'electronics' as const,
      condition: 'like_new' as const,
      priceTaka: 1200,
      description: 'Used for one term, with cover. (Sample listing.)',
      meetPlace: 'cafeteria' as const,
      meetDetail: 'Near the tea stall',
    },
    {
      createdById: mim.id,
      title: 'Engineering drawing set (demo)',
      category: 'lab_equipment' as const,
      condition: 'good' as const,
      priceTaka: 350,
      description: 'Compass, set squares and protractor. (Sample listing.)',
      meetPlace: 'academic_building' as const,
      meetDetail: null,
    },
    {
      createdById: student.id,
      title: 'First-year physics notes (demo)',
      category: 'books' as const,
      condition: 'fair' as const,
      priceTaka: 0,
      description: 'Free to a junior who needs them. (Sample listing.)',
      meetPlace: 'central_library' as const,
      meetDetail: 'Ground floor',
    },
    {
      createdById: student.id,
      title: 'Bicycle, 26 inch (demo)',
      category: 'bicycles' as const,
      condition: 'good' as const,
      priceTaka: 6500,
      description: 'Recently serviced. Reserved for now. (Sample listing.)',
      meetPlace: 'main_gate' as const,
      meetDetail: null,
      state: 'reserved' as const,
    },
  ];

  for (const listing of listings) {
    if (await prisma.listing.findFirst({ where: { title: listing.title } })) continue;
    await prisma.listing.create({
      data: { ...listing, expiresAt: new Date(Date.now() + 30 * DAY_MS) },
    });
  }
}
