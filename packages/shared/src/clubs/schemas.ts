import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';
import { mediaAssetSchema } from '../media/schemas.js';

export const CLUB_CATEGORIES = [
  'technical',
  'cultural',
  'sports',
  'social_service',
  'academic',
  'other',
] as const;
export type ClubCategory = (typeof CLUB_CATEGORIES)[number];

export const CLUB_ROLES = ['manager', 'member'] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

export const MEMBERSHIP_STATES = ['pending', 'active'] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

export const CLUB_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  taglineMax: 140,
  aboutMax: 4000,
  links: 3,
  managers: 5,
} as const;

const emptyToNull = (value: unknown) => (value === '' ? null : value);
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

/** "RUET Robotics Society" -> "ruet-robotics-society". The URL of a club page. */
export function clubSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const clubLinkSchema = z.object({
  label: z.string().trim().min(1, 'Name the link').max(40),
  url: z
    .url({ protocol: /^https?$/, message: 'Use a full web address starting with https://' })
    .max(300),
});
export type ClubLink = z.infer<typeof clubLinkSchema>;

const nameSchema = z
  .string()
  .trim()
  .min(CLUB_LIMITS.nameMin, `Names need at least ${CLUB_LIMITS.nameMin} characters`)
  .max(CLUB_LIMITS.nameMax, `Names are at most ${CLUB_LIMITS.nameMax} characters`)
  .refine((name) => clubSlug(name).length >= 2, 'Use letters or numbers in the name');

const profileFields = {
  tagline: z
    .string()
    .trim()
    .min(1, 'Describe the club in one line')
    .max(CLUB_LIMITS.taglineMax, `At most ${CLUB_LIMITS.taglineMax} characters`),
  category: z.enum(CLUB_CATEGORIES, 'Pick a category'),
  about: z.string().trim().max(CLUB_LIMITS.aboutMax, `At most ${CLUB_LIMITS.aboutMax} characters`),
};

const managerIdsSchema = z
  .array(z.uuid())
  .min(1, 'Pick at least one manager')
  .max(CLUB_LIMITS.managers, `At most ${CLUB_LIMITS.managers} managers`)
  .refine((ids) => new Set(ids).size === ids.length, 'A manager is listed twice');

/** POST /clubs (admins). */
export const createClubRequestSchema = z
  .object({ name: nameSchema, ...profileFields, managerIds: managerIdsSchema })
  .strict();
export type CreateClubRequest = z.infer<typeof createClubRequestSchema>;

/** PATCH /clubs/:id (the club's managers and admins). Only admins may rename. */
export const updateClubRequestSchema = z
  .object({
    name: nameSchema.optional(),
    ...profileFields,
    contactEmail: z.preprocess(emptyToNull, z.email('Enter a valid email').max(254).nullable()),
    links: z.array(clubLinkSchema).max(CLUB_LIMITS.links, `At most ${CLUB_LIMITS.links} links`),
    /** A checked upload (purpose "clubs.logo"), or null to remove the logo. */
    logoId: z.uuid().nullable(),
    coverId: z.uuid().nullable(),
  })
  .strict();
export type UpdateClubRequest = z.infer<typeof updateClubRequestSchema>;

/** PUT /clubs/:id/managers (admins). */
export const setManagersRequestSchema = z.object({ userIds: managerIdsSchema }).strict();
export type SetManagersRequest = z.infer<typeof setManagersRequestSchema>;

const personSchema = z.object({ id: z.string(), name: z.string(), role: z.enum(ROLES) });

export const myMembershipSchema = z.object({
  role: z.enum(CLUB_ROLES),
  state: z.enum(MEMBERSHIP_STATES),
});

export const clubSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  category: z.enum(CLUB_CATEGORIES),
  logo: mediaAssetSchema.nullable(),
  memberCount: z.number().int(),
  /** The viewer's place in the club, or null. */
  myMembership: myMembershipSchema.nullable(),
  /** Hidden or removed by a moderator; only its managers and staff still get it. */
  moderated: z.boolean(),
});
export type ClubSummary = z.infer<typeof clubSummarySchema>;

export const clubDetailSchema = clubSummarySchema.extend({
  about: z.string(),
  cover: mediaAssetSchema.nullable(),
  contactEmail: z.string().nullable(),
  links: z.array(clubLinkSchema),
  managers: z.array(personSchema),
  /** Managers and admins may edit the page. */
  canEdit: z.boolean(),
});
export type ClubDetail = z.infer<typeof clubDetailSchema>;

export const clubPageSchema = cursorPageSchema(clubSummarySchema);
export type ClubPage = z.infer<typeof clubPageSchema>;

export const clubListQuerySchema = cursorPageQuerySchema.extend({
  q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  category: z.preprocess(emptyToUndefined, z.enum(CLUB_CATEGORIES).optional()),
});
export type ClubListQuery = z.infer<typeof clubListQuerySchema>;
export type ClubListQueryInput = z.input<typeof clubListQuerySchema>;

export const clubMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  role: z.enum(ROLES),
  clubRole: z.enum(CLUB_ROLES),
  state: z.enum(MEMBERSHIP_STATES),
  since: z.string(),
});
export type ClubMember = z.infer<typeof clubMemberSchema>;

export const clubMemberPageSchema = cursorPageSchema(clubMemberSchema);
export type ClubMemberPage = z.infer<typeof clubMemberPageSchema>;

/** Members are listed to members; pending requests only to managers. */
export const clubMembersQuerySchema = cursorPageQuerySchema.extend({
  state: z.preprocess(emptyToUndefined, z.enum(MEMBERSHIP_STATES).default('active')),
});
export type ClubMembersQuery = z.infer<typeof clubMembersQuerySchema>;

export const clubIdParamSchema = z.object({ id: z.uuid() });
export const clubSlugParamSchema = z.object({ slug: z.string().min(1).max(60) });
export const clubMemberParamSchema = z.object({ id: z.uuid(), userId: z.uuid() });

/** How a news post shows the club it was posted for. */
export const clubRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});
export type ClubRef = z.infer<typeof clubRefSchema>;
