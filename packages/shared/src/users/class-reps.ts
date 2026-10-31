import { z } from 'zod';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { CLASS_SECTIONS, departmentSummarySchema } from './schemas.js';

/**
 * Class representatives (CRs). A student asks to be verified as the CR of their own class
 * (department and series come from their roll, so they cannot claim another class) and staff
 * approve or reject. It lasts until they step down or staff revoke it.
 */
export const CLASS_REP_STATUSES = [
  'pending',
  'approved',
  'rejected',
  /** The student took back a pending request. */
  'withdrawn',
  /** Ended after approval: the student stepped down, or staff revoked it. */
  'revoked',
] as const;
export type ClassRepStatus = (typeof CLASS_REP_STATUSES)[number];

/** Roles held by current students. Alumni, teachers and admins cannot be CRs. */
export const CLASS_REP_ELIGIBLE_ROLES = ['student', 'club_manager', 'moderator'] as const;

export const CLASS_REP_LIMITS = {
  noteMinLength: 10,
  noteMaxLength: 300,
} as const;

export const classRepApplyRequestSchema = z
  .object({
    /** null when the class has no sections. */
    section: z.enum(CLASS_SECTIONS).nullable(),
    /** How staff can check it, e.g. who appointed them or when. Staff only see this. */
    note: z
      .string()
      .trim()
      .min(
        CLASS_REP_LIMITS.noteMinLength,
        `Write at least ${CLASS_REP_LIMITS.noteMinLength} characters`,
      )
      .max(
        CLASS_REP_LIMITS.noteMaxLength,
        `Keep it under ${CLASS_REP_LIMITS.noteMaxLength} characters`,
      ),
  })
  .strict();
export type ClassRepApplyRequest = z.infer<typeof classRepApplyRequestSchema>;

/** One request, as its owner (and staff) see it. */
export const classRepRequestSchema = z.object({
  id: z.string(),
  status: z.enum(CLASS_REP_STATUSES),
  section: z.enum(CLASS_SECTIONS).nullable(),
  note: z.string(),
  /** Staff's reason on rejection or revocation. */
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
});
export type ClassRepRequest = z.infer<typeof classRepRequestSchema>;

/** The member's latest request, or null if they never asked. */
export const myClassRepSchema = z.object({ request: classRepRequestSchema.nullable() });
export type MyClassRep = z.infer<typeof myClassRepSchema>;

/** A request in the staff list, with who asked and for which class. */
export const classRepReviewItemSchema = classRepRequestSchema.extend({
  user: z.object({
    id: z.string(),
    name: z.string(),
    roll: z.string(),
    department: departmentSummarySchema.nullable(),
    series: z.number().int().nullable(),
  }),
});
export type ClassRepReviewItem = z.infer<typeof classRepReviewItemSchema>;

export const classRepReviewPageSchema = cursorPageSchema(classRepReviewItemSchema);
export type ClassRepReviewPage = z.infer<typeof classRepReviewPageSchema>;

export const classRepReviewQuerySchema = cursorPageQuerySchema.extend({
  /** Waiting requests, or the current CRs (to revoke). */
  status: z.enum(['pending', 'approved']).default('pending'),
});
export type ClassRepReviewQuery = z.infer<typeof classRepReviewQuerySchema>;

export const classRepIdParamSchema = z.uuid('Unknown request');
