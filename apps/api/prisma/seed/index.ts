// Runs every module's seed in dependency order. See the `seed-dummy-data` skill.
// Each module adds `await seed<Module>(prisma)` here when it is built.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedAdmin } from './admin.js';
import { seedChat } from './chat.js';
import { seedUsers } from './users.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await seedUsers(prisma);
  await seedAdmin(prisma);
  await seedChat(prisma);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seeding failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
