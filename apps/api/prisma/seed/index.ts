// Runs every module's seed in dependency order. See the `seed-dummy-data` skill.
// Each module adds `await seed<Module>(prisma)` here when it is built.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedAdmin } from './admin.js';
import { seedBus } from './bus.js';
import { seedChat } from './chat.js';
import { seedClubs } from './clubs.js';
import { seedEvents } from './events.js';
import { seedLostFound } from './lost-found.js';
import { seedMarketplace } from './marketplace.js';
import { seedModeration } from './moderation.js';
import { seedNews } from './news.js';
import { seedNotifications } from './notifications.js';
import { seedClassReps, seedUsers } from './users.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Seeds create demo accounts with a published password: never on a live database.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production. Seed development and staging only.');
  }
  await seedUsers(prisma);
  await seedClassReps(prisma);
  await seedAdmin(prisma);
  await seedChat(prisma);
  await seedModeration(prisma);
  await seedNews(prisma);
  await seedClubs(prisma);
  await seedEvents(prisma);
  await seedLostFound(prisma);
  await seedMarketplace(prisma);
  await seedBus(prisma);
  await seedNotifications(prisma);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seeding failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
