import { z } from 'zod';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { DEPARTMENTS } from '../users/departments.js';
import { publicProfileSchema } from '../users/schemas.js';

/** Roles people search for. Staff roles (moderator, admin…) are still found by name. */
export const DIRECTORY_ROLES = ['student', 'alumni', 'teacher'] as const;

const departmentShorts = [...new Set(DEPARTMENTS.map((d) => d.short))] as [string, ...string[]];

/** `GET /directory?q=&department=&series=&role=&cursor=&limit=`. Empty values mean "any". */
export const directoryQuerySchema = cursorPageQuerySchema.extend({
  /** Part of a name, or the start of a roll. */
  q: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).max(80).optional(),
  ),
  department: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(departmentShorts, 'Unknown department').optional(),
  ),
  series: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1964).max(2100).optional(),
  ),
  role: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(DIRECTORY_ROLES).optional(),
  ),
});
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;
export type DirectoryQueryInput = z.input<typeof directoryQuerySchema>;

export const directoryPageSchema = cursorPageSchema(publicProfileSchema);
export type DirectoryPage = z.infer<typeof directoryPageSchema>;
