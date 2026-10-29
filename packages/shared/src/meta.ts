import { z } from 'zod';
import { MODULE_KEYS } from './modules.js';

/** GET /api/v1/health */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    database: z.enum(['up', 'down', 'not_configured']),
    redis: z.enum(['up', 'down', 'not_configured']),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** GET /api/v1/features: which modules are switched on. */
export const featuresResponseSchema = z.object({
  modules: z.array(z.enum(MODULE_KEYS)),
});

export type FeaturesResponse = z.infer<typeof featuresResponseSchema>;
