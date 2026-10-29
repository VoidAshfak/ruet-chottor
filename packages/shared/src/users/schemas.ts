import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';

/** A guide key is usually a module key, e.g. `lost-found`, or a page key like `home`. */
export const guideKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,39}$/, 'Unknown guide');

/** Upper bound on stored guide keys, so the list cannot be grown without limit. */
export const MAX_DISMISSED_GUIDES = 50;

export const departmentSummarySchema = z.object({
  code: z.string(),
  short: z.string(),
  name: z.string(),
});

/**
 * What any logged-in member sees. Email and phone are null unless the owner chose to show them.
 * Date of birth is never included (CLAUDE.md §6).
 */
export const publicProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  role: z.enum(ROLES),
  /** From the roll; null for a roll with an unknown department code. */
  department: departmentSummarySchema.nullable(),
  series: z.number().int().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** The owner's own view: always includes email and phone, plus their settings. */
export const myProfileSchema = publicProfileSchema.extend({
  email: z.string(),
  phone: z.string(),
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  dismissedGuides: z.array(z.string()),
});
export type MyProfile = z.infer<typeof myProfileSchema>;

export const updateMyProfileRequestSchema = z
  .object({
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
export type UpdateMyProfileRequest = z.infer<typeof updateMyProfileRequestSchema>;

export const dismissGuideRequestSchema = z.object({ moduleKey: guideKeySchema });
export type DismissGuideRequest = z.infer<typeof dismissGuideRequestSchema>;

export const dismissedGuidesResponseSchema = z.object({ dismissedGuides: z.array(z.string()) });
export type DismissedGuidesResponse = z.infer<typeof dismissedGuidesResponseSchema>;

export const userIdParamSchema = z.uuid('Unknown user');
