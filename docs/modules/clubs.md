# Clubs

RUET clubs in one place: a page per club, its managers and members, and news posted in the club's name. Admins
create clubs and appoint managers; members ask to join and a manager approves.

**Status:** Done (Phase 3). Events (next) will belong to clubs.
**Feature flag:** `FEATURE_CLUBS` (needs `FEATURE_AUTH` and `FEATURE_ADMIN`; appointing a manager changes their
role, which is written to admin's moderation log). Logos and covers need `CLOUDINARY_URL`; manager picking needs
`FEATURE_DIRECTORY`; reporting needs `FEATURE_MODERATION`.

## User flows

- A member opens **Clubs**: their own clubs on top, then every club, searchable by name and filtered by category
  (Technical, Cultural, Sports, Social service, Academic, Other).
- A club page shows the cover, logo, tagline, about text, managers, contact email, links and member count, plus
  **See news from this club** (`/news?club=<id>`) and **See this club's events** (`/events?club=<id>`).
- **Ask to join** sends a request; it shows "Request sent" (with **Cancel request**) until a manager approves, then
  "Member" (with **Leave club**, confirmed).
- A club's managers **Edit page** (tagline, category, about, contact email, up to 3 links, logo, cover) and open
  **Members and requests** to approve or decline requests and remove members (confirmed).
- When writing news, a club manager can **Post as** one of their clubs; the post shows "for <club>" and links to it.
- An admin opens **Admin → Clubs** to create a club (name, tagline, category, managers) and **Change managers**.
  Appointed students, alumni and teachers become `club_manager` (logged), so their news skips review.
- Anyone can **Report** a club page; moderators hide or remove it from the Reports queue.

## Roles & permissions

| Action | Member | The club's manager | admin |
|---|---|---|---|
| Browse clubs, view pages and the member list | ✅ | ✅ | ✅ |
| Ask to join, leave | ✅ | ✅ (not the last manager) | ✅ |
| See join requests, approve, decline, remove members | ❌ | ✅ | ✅ |
| Edit the club page | ❌ | ✅ | ✅ |
| Rename a club, create clubs, change managers | ❌ | ❌ | ✅ |
| Post news as the club | ❌ | ✅ | ❌ (unless also a manager) |

Manager rights are per club and checked in `ClubsService` from the database; admin routes also use
`@Roles('admin')`. Suspended members cannot join or manage.

## Data model

See the `// ===== clubs =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Club**: `name` (unique), `slug` (unique, from the name; the page URL), `tagline`, `category`, `about`,
  `contactEmail` (the club's public address), `links` (JSON, up to 3 `{ label, url }`, https only), `createdById`,
  `status` (`visible | hidden | removed`, from moderation).
- **ClubMembership**: `clubId` + `userId`, `role` (`manager | member`), `state` (`pending | active`),
  `requestedAt`, `joinedAt`.
- Logo and cover are `MediaAsset`s with purposes `clubs.logo` and `clubs.cover` (one image each).
- `NewsPost.clubId` (news module) links a post to a club.

## API

All paths start with `/api/v1/clubs` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/?q=&category=&cursor=` | member | Visible clubs, by name |
| GET | `/mine` | member | Clubs you manage, belong to or asked to join |
| GET | `/:slug` | member | Club page (`canEdit` for its managers and admins) |
| POST | `/` | admin | `{ name, tagline, category, about, managerIds }` → `409` if the name exists |
| PATCH | `/:id` | manager, admin | `{ name? (admin), tagline, category, about, contactEmail, links, logoId, coverId }` |
| PUT | `/:id/managers` | admin | `{ userIds }` (1–5); former managers stay as members |
| POST | `/:id/membership` | member | Ask to join → `409` if already asked or a member |
| DELETE | `/:id/membership` | member | Leave or cancel the request (`400` for the last manager) |
| GET | `/:id/members?state=active\|pending` | member / manager | Members; `pending` for managers only |
| POST | `/:id/members/:userId/approve` | manager, admin | Approve a request |
| DELETE | `/:id/members/:userId` | manager, admin | Decline or remove (not managers) |

Rate limits: 30 join requests and 120 management actions per hour per person.

## Moderation

`clubs.club` is registered with the moderation registry (`clubs-moderation.ts`). Staff see the club's name, tagline
and about text, with its first manager as the responsible person. Hidden or removed clubs leave the list and their
page is served only to their managers and admins (marked `moderated`).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_CLUBS` | off | Registers `/clubs` routes (only together with `FEATURE_ADMIN`), shows **Clubs**, **Admin → Clubs** and **Post as** in News |

## Code map

- Backend: `apps/api/src/modules/clubs/` (`ClubsService` — exported for news and events: `isManager()`,
  `managedAmong()`, `refs()` — `ClubsController`, `ClubsModeration`)
- Frontend: `apps/web/src/features/clubs/` (`ClubsDirectory`, `ClubPage`, `ClubEditor`, `ClubMembers`, `AdminClubs`)
- Pages: `apps/web/src/app/(app)/clubs`, `clubs/[slug]`, `clubs/[slug]/edit`, `clubs/[slug]/members`, `admin/clubs`
- Schemas: `packages/shared/src/clubs/`
- Seed: `apps/api/prisma/seed/clubs.ts` (three demo clubs; the Demo Student is a member of one and waiting for another)
- Tests: `packages/shared/src/clubs/schemas.spec.ts`, `apps/api/test/clubs.e2e-spec.ts`, `apps/web/e2e/clubs.spec.ts`

## Known limitations / future work

- Removing someone as manager does not take away their `club_manager` role; an admin changes it in Admin → Members.
- No notifications for join requests or approvals (needs `notifications`).
- No club archive/delete; admins hide a club through moderation.
