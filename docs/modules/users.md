# Users

Member profiles. Each member has a profile page showing their name, role, roll, department and series, plus their
email and phone only if they chose to share them. Members control that privacy on **My profile**. This module
also remembers which first-visit guides a member has closed, so a guide never shows twice on any device, and
verifies **class representatives (CRs)**: a student asks, a moderator or admin checks, and a verified CR gets a badge.

**Status:** Done (Phase 1).
**Feature flag:** `FEATURE_USERS` (needs `FEATURE_AUTH` too: every route needs a logged-in member). Class reps also
need `FEATURE_ADMIN`, because staff decisions go to admin's moderation log.

## User flows

- A member opens **My profile** (`/profile`, or their name in the header) and sees what others see about them.
- A member turns "Show my email" / "Show my phone number" on or off. Both are off by default. Each switch saves at once.
- A member opens another member's profile at `/users/<id>` and sees only the contact details that person shares.
- A member closes a first-visit guide; it stays closed on every device. "Show tips again" brings all guides back.
- Department and series are worked out from the roll and cannot be edited ([ADR 0006](../decisions/0006-department-from-roll.md)).
- **Class representative:** on My profile a current student picks their section (A–E or "no sections") and writes a
  short proof note (who chose them, who can confirm). The class itself comes from the roll, so nobody can claim
  another class. The request waits in **Admin → Class reps**, where a moderator or admin verifies or turns it down
  (with a reason the student sees). A verified CR shows a "CR · Section A" badge on their profile and directory card
  until they **step down** or staff **remove** it. Every staff decision is logged and the student is notified.

## Roles & permissions

| Action | student | alumni | teacher | club_manager | moderator | admin |
|---|---|---|---|---|---|---|
| View and edit own profile settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View another member's public profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ask to be verified as CR, withdraw, step down | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Verify, turn down or remove CRs (not their own) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

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
- **ClassRepRequest** (`class_rep_requests`): `userId`, `section` (A–E or null), `note` (staff only), `status`
  (`pending | approved | rejected | withdrawn | revoked`), `reviewNote`, `reviewedById`, `reviewedAt`. A partial
  unique index allows one open (pending or approved) request per member; older rows stay as history.
- Never returned: date of birth, password hash, account status.

## API

All paths start with `/api/v1`. All routes need a logged-in member. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/users/me` | any member | My profile: public fields + my email, phone, `showEmail`, `showPhone`, `dismissedGuides` |
| PATCH | `/users/me` | any member | `{ showEmail?, showPhone? }` (at least one, nothing else) → my profile. 30 per 15 min |
| PATCH | `/users/me/guides` | any member | `{ moduleKey }` → `{ dismissedGuides }`. 60 per 15 min (shared with reset) |
| DELETE | `/users/me/guides` | any member | Clears all dismissed guides → `{ dismissedGuides: [] }` |
| GET | `/users/:id` | any member | Public profile: `id, name, roll, role, department, series, email, phone, classRep` (email/phone `null` unless shared; `classRep` is `{ section, since }` for a verified CR, else `null`). `400` for a malformed id, `404` if missing, suspended or banned |
| GET | `/users/me/class-rep` | any member | `{ request }`: my latest CR request, or `null` |
| POST | `/users/me/class-rep` | student, club_manager, moderator | `{ section, note }` → `{ request }` (201). `400` if the roll's class is unknown, `409` if one is already open. 5 per day |
| DELETE | `/users/me/class-rep` | any member | Withdraws a pending request or steps down → `{ request }`. `404` if nothing is open |
| GET | `/users/class-reps?status=pending|approved&cursor=&limit=` | moderator, admin | Requests with who asked and their class |
| POST | `/users/class-reps/:id/approve` | moderator, admin | Verifies a pending request. `403` on your own request, `404` if not pending |
| POST | `/users/class-reps/:id/reject` | moderator, admin | `{ reason }` → turns down a pending request |
| POST | `/users/class-reps/:id/revoke` | moderator, admin | `{ reason }` → ends an approved CR |

## Moderation

No free text is stored: the name comes from sign-up (auth) and cannot be changed here. Bios and photos are
deliberately left out until the `moderation` module exists (CLAUDE.md §7).

The CR proof note is free text but only staff and its author ever see it, so it is not reportable. Staff decisions
are written to the moderation log (`verify_class_rep`, `reject_class_rep`, `revoke_class_rep`) against the member,
in the same transaction as the decision. Staff roles are re-read from the database on every review.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_USERS` | off | Registers the `/users` routes, the profile link in the header, and server-side guide memory |
| `FEATURE_ADMIN` | off | Also registers the class rep routes, the My profile card and the Admin → Class reps tab |

## Code map

- Backend: `apps/api/src/modules/users/` (`UsersService`, exported for the directory module; `ClassRepsService` and
  `ClassRepsController`, registered only with `FEATURE_ADMIN`)
- Frontend: `apps/web/src/features/users/` (`MyProfile`, `UserProfile`, `PrivacySettings`, `GuideReset`, `GuideSyncProvider`,
  `ClassRepCard`, `ClassRepBadge` (exported, used by the directory), `AdminClassReps`)
- Pages: `apps/web/src/app/(app)/profile`, `apps/web/src/app/(app)/users/[id]`, `apps/web/src/app/(app)/admin/class-reps`
- Guide memory: `GuideSyncProvider` fills `GuideSyncContext` (`apps/web/src/components/guide/guide-sync.ts`);
  `useGuideDismissal` falls back to localStorage for visitors or when this module is off.
- Schemas and department table: `packages/shared/src/users/`
- Seed: `apps/api/prisma/seed/users.ts` (demo accounts, see [getting-started](../getting-started.md#demo-accounts); one
  verified CR, Rafiq Fakeuddin, and one waiting request, Sadia Sample)
- Tests: `apps/api/src/modules/users/users.service.spec.ts`, `class-reps.service.spec.ts`,
  `apps/api/test/users.e2e-spec.ts`, `apps/api/test/class-reps.e2e-spec.ts`,
  `packages/shared/src/users/departments.spec.ts`, `apps/web/e2e/users.spec.ts`, `apps/web/e2e/class-reps.spec.ts`

## Known limitations / future work

- **No profile photo or bio** yet (needs `StorageService` and the `moderation` module).
- **Name cannot be changed** by the member; an admin tool for corrections comes with `admin`.
- **Teachers and staff** have no student roll; the department field reads "Unknown" or a guess for them.
- "Show tips again" clears this device's cached guide memory; another device that cached a closed guide
  locally keeps it closed there.
- Contact visibility is all-or-nothing for logged-in members; finer audiences (e.g. same series only) could come later.
- **CR status does not follow role changes:** a CR whose role becomes alumni keeps the badge until staff remove it.
- **CRs cannot create events yet;** that is the next step (class events with moderator approval).
