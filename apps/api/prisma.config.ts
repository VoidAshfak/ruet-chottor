import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The Prisma CLI (migrate, studio) uses the direct connection. On Neon the app itself
// uses the pooled DATABASE_URL, but migrations need the non-pooled DIRECT_URL.
// A placeholder lets `prisma generate` run (e.g. in CI) without any database.
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://not-configured:5432/not-configured';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: { url },
});
