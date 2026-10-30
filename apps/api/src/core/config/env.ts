import { enabledModules, type ModuleKey } from '@ruet-chottor/shared';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    // Optional so the app (and `pnpm test`) starts without hosted services;
    // features that need them answer 503 until they are set.
    DATABASE_URL: z.url().optional(),
    REDIS_URL: z.url().optional(),
    // Signs one-time login codes before they are stored in Redis.
    OTP_SECRET: z.string().min(32).optional(),
    SMTP_URL: z.url().optional(),
    MAIL_FROM: z.string().min(3).default('"RUET Chottor" <no-reply@example.com>'),
    // Spam protection for chat (CLAUDE.md §7): messages one member may send per minute.
    CHAT_SEND_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['DATABASE_URL', 'REDIS_URL', 'OTP_SECRET', 'SMTP_URL'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
  });

export type Env = z.infer<typeof envSchema> & {
  ENABLED_MODULES: ModuleKey[];
  [flag: `FEATURE_${string}`]: string | undefined;
};

/** Validates process.env at startup; the app refuses to boot with a bad config. */
export function validateEnv(raw: Record<string, unknown>): Env {
  // Empty values copied from .env.example mean "not set".
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const flags = Object.fromEntries(
    Object.entries(raw).filter(([key]) => key.startsWith('FEATURE_')),
  ) as Record<`FEATURE_${string}`, string>;
  return {
    // ConfigModule copies the returned object into process.env, where ConditionalModule reads
    // the flags (app.module.ts). Without them here, flags set in .env would be dropped.
    ...flags,
    ...result.data,
    ENABLED_MODULES: enabledModules(raw as Record<string, string | undefined>),
  };
}
