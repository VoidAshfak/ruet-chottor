# Directory

A searchable list of RUET Chottor members. Students, alumni and teachers can find each other by name or roll,
and narrow the list by department, series and role. It replaces asking around in Facebook groups for someone's
contact: each result shows an email or phone only if that member chose to share it.

**Status:** Done (Phase 1).
**Feature flag:** `FEATURE_DIRECTORY` (needs `FEATURE_AUTH` and `FEATURE_USERS`)

## User flows

- A member opens **Directory** and sees every active member, sorted by name, 20 at a time ("Show more" loads more).
- A member types part of a name (`rahman`) or the start of a roll (`1703`). The search runs after a short pause.
- A member filters by department, series (admission year) and role (student, alumni, teacher).
- A member opens a result to see the full profile (`/users/<id>`, from the `users` module).
- Filters live in the URL, so Back from a profile returns to the same search, and a search can be shared as a link.

## Roles & permissions

| Action | student | alumni | teacher | club_manager | moderator | admin |
|---|---|---|---|---|---|---|
| Search the directory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Visitors get `401`. Suspended and banned members never appear.

## Data model

No tables of its own. It reads members through `UsersService.listPublic()` (exported by `users`), which applies
the "active members only" rule and each member's contact privacy. Directory only decides *who* matches.

Department and series filters become roll prefixes (`CSE` + `2017` → rolls starting `1703`), computed by
`rollPrefixes()` in [`packages/shared/src/users/departments.ts`](../../packages/shared/src/users/departments.ts)
([ADR 0006](../decisions/0006-department-from-roll.md)).

## API

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/api/v1/directory?q=&department=&series=&role=&cursor=&limit=` | any member | `{ items: PublicProfile[], nextCursor }`, sorted by name. `q`: name (case-insensitive, part of it) or roll prefix (digits only). `department`: short name, e.g. `CSE`. `series`: year, e.g. `2017`. `role`: `student`, `alumni` or `teacher`. Empty values mean "any". `limit` 1–100, default 20. 120 searches per minute per member |

`PublicProfile` is described in [users.md](users.md#api).

## Moderation

Nothing is stored. Members hidden by moderation (suspended or banned) are excluded by `UsersService`.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_DIRECTORY` | off | Registers `/directory` and shows the Directory nav item |

## Code map

- Backend: `apps/api/src/modules/directory/` (`directoryWhere()` builds the filter, `DirectoryService` rate-limits and calls `UsersService`)
- Frontend: `apps/web/src/features/directory/` (`DirectorySearch`, `DirectoryFilterBar`, `MemberCard`)
- Page: `apps/web/src/app/(app)/directory`
- Schemas: `packages/shared/src/directory/`
- Seed: none; the `users` seed provides the members
- Tests: `apps/api/src/modules/directory/directory.service.spec.ts`, `apps/api/test/directory.e2e-spec.ts`,
  `apps/web/e2e/directory.spec.ts`

## Known limitations / future work

- **Name search is a simple "contains"** match. Spelling variants (Mohammad / Muhammad) are not matched; Postgres
  full-text or trigram search can come when the member list grows.
- Filtering by department alone matches up to 100 roll prefixes; fine for RUET's size, revisit with an index on a
  computed column if it ever gets slow.
- Teachers and staff have no student roll, so department and series filters do not find them reliably.
- No "message this person" button yet; it comes with `chat` (Phase 2).
