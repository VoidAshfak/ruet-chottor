import { enabledModules, type ModuleKey } from '@ruet-chottor/shared';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  // Optional until Phase 1 so the scaffold runs before the hosted services are set up.
  DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema> & { ENABLED_MODULES: ModuleKey[] };

/** Validates process.env at startup; the app refuses to boot with a bad config. */
export function validateEnv(raw: Record<string, unknown>): Env {
  // Empty values copied from .env.example mean "not set".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return {
    ...result.data,
    ENABLED_MODULES: enabledModules(raw as Record<string, string | undefined>),
  };
}
