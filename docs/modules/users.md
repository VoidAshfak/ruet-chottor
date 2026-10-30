# Users

Member profiles. Each member has a profile page showing their name, role, roll, department and series, plus their
email and phone only if they chose to share them. Members control that privacy on **My profile**. This module
also remembers which first-visit guides a member has closed, so a guide never shows twice on any device.

**Status:** Done (Phase 1).
**Feature flag:** `FEATURE_USERS` (needs `FEATURE_AUTH` too: every route needs a logged-in member)

## User flows

- A member opens **My profile** (`/profile`, or their name in the header) and sees what others see about them.
- A member turns "Show my email" / "Show my phone number" on or off. Both are off by default. Each switch saves at once.
- A member opens another member's profile at `/users/<id>` and sees only the contact details that person shares.
- A member closes a first-visit guide; it stays closed on every device. "Show tips again" brings all guides back.
- Department and series are worked out from the roll and cannot be edited ([ADR 0006](../decisions/0006-department-from-roll.md)).

## Roles & permissions

| Action | student | alumni | teacher | club_manager | moderator | admin |
|---|---|---|---|---|---|---|
| View and edit own profile settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View another member's public profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Visitors (not logged in) get `401` on every route. Suspended and banned members cannot be viewed (`404`).

## Data model

See the `// ===== users =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Profile** (one per `User`, created the first time a setting changes; missing = all defaults):
  - `showEmail`, `showPhone`: directory privacy, default `false`.
  - `dismissedGuides`: keys of closed first-visit guides, e.g. `home`, `users` (max 50).
- **Not stored:** department and series. They come from the roll via
  [`packages/shared/src/users/departments.ts`](../../packages/shared/src/users/departments.ts) — the only place to
  edit department codes. To change a code later, close the old entry with `untilSeries` and add a new one with
  `fromSeries`.
- Never returned: date of birth, password hash, account status.

## API

All paths start with `/api/v1`. All routes need a logged-in member. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/users/me` | any member | My profile: public fields + my email, phone, `showEmail`, `showPhone`, `dismissedGuides` |
| PATCH | `/users/me` | any member | `{ showEmail?, showPhone? }` (at least one, nothing else) → my profile. 30 per 15 min |
| PATCH | `/users/me/guides` | any member | `{ moduleKey }` → `{ dismissedGuides }`. 60 per 15 min (shared with reset) |
| DELETE | `/users/me/guides` | any member | Clears all dismissed guides → `{ dismissedGuides: [] }` |
| GET | `/users/:id` | any member | Public profile: `id, name, roll, role, department, series, email, phone` (email/phone `null` unless shared). `400` for a malformed id, `404` if missing, suspended or banned |

## Moderation

No free text is stored: the name comes from sign-up (auth) and cannot be changed here. Bios and photos are
deliberately left out until the `moderation` module exists (CLAUDE.md §7).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_USERS` | off | Registers the `/users` routes, the profile link in the header, and server-side guide memory |

## Code map

- Backend: `apps/api/src/modules/users/` (`UsersService`, exported for the directory module, and `toPublicProfile`)
- Frontend: `apps/web/src/features/users/` (`MyProfile`, `UserProfile`, `PrivacySettings`, `GuideReset`, `GuideSyncProvider`)
- Pages: `apps/web/src/app/(app)/profile`, `apps/web/src/app/(app)/users/[id]`
- Guide memory: `GuideSyncProvider` fills `GuideSyncContext` (`apps/web/src/components/guide/guide-sync.ts`);
  `useGuideDismissal` falls back to localStorage for visitors or when this module is off.
- Schemas and department table: `packages/shared/src/users/`
- Seed: `apps/api/prisma/seed/users.ts` (demo accounts, see [getting-started](../getting-started.md#demo-accounts))
- Tests: `apps/api/src/modules/users/users.service.spec.ts`, `apps/api/test/users.e2e-spec.ts`,
  `packages/shared/src/users/departments.spec.ts`, `apps/web/e2e/users.spec.ts`

## Known limitations / future work

- **No profile photo or bio** yet (needs `StorageService` and the `moderation` module).
- **Name cannot be changed** by the member; an admin tool for corrections comes with `admin`.
- **Teachers and staff** have no student roll; the department field reads "Unknown" or a guess for them.
- "Show tips again" clears this device's cached guide memory; another device that cached a closed guide
  locally keeps it closed there.
- Contact visibility is all-or-nothing for logged-in members; finer audiences (e.g. same series only) could come later.
