# Admin

The staff side of RUET Chottor. Moderators and admins find any member (including suspended and banned ones),
warn, suspend, ban or reinstate them, and read the moderation log. Admins can also change roles. This is the
base that every later module adds its own moderation views to (CLAUDE.md §7).

**Status:** In progress (Phase 1: panel base)
**Feature flag:** `FEATURE_ADMIN` (needs `FEATURE_AUTH`)

## User flows

- A moderator opens **Admin** in the header (only staff see it) and searches members by name or roll,
  filtered by role and status.
- A moderator opens a member and **warns** them. The member gets an email with the reason.
- A moderator **suspends** a member for 1–90 days. The member is logged out everywhere, gets an email, and can log
  in again after the time is up (the suspension is lifted at that login).
- A moderator **bans** a member (logged out everywhere, cannot log in) or **reinstates** a suspended or banned member.
- An admin **changes a member's role**, e.g. student → club manager.
- Every action needs a reason (5–500 characters) and a confirmation, and is written to the **moderation log**.
- Anyone on staff reads the full log, newest first. With `FEATURE_MODERATION`, a **Reports** tab holds the content
  queue ([moderation.md](moderation.md)); content actions show in the log with a link to the item.

## Roles & permissions

| Action | student | alumni | teacher | club_manager | moderator | admin |
|---|---|---|---|---|---|---|
| Open the admin panel, list members, read the log | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Warn, suspend, ban, reinstate a normal member | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Do the above to a moderator or admin | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Change a role | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Nobody can act on their own account. Roles are checked twice on the server: by `@Roles` on the route (from the
access token), and again from the database inside `AdminService`.

## Data model

See the `// ===== admin =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma) and
[ADR 0007](../decisions/0007-moderation-log-and-account-sanctions.md).

- **ModerationLog** (append-only; a database trigger rejects `UPDATE` and `DELETE`):
  `moderatorId`, `action` (`warn_user | suspend_user | ban_user | reinstate_user | change_role`, and the content
  actions `hide_content | remove_content | restore_content | dismiss_reports` from moderation), `targetUserId`,
  `contentType` / `contentId`, `reason`, `details` (e.g. `{ days: 7 }`,
  `{ from: "student", to: "moderator" }`), `createdAt`.
- **User** (auth): `status` (`active | suspended | banned`) and `suspendedUntil`.

Staff never see a member's email, phone or date of birth in the panel.

## API

All paths start with `/api/v1/admin`. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/users?q=&role=&status=&cursor=&limit=` | moderator, admin | Members of any status, sorted by name |
| GET | `/users/:id` | moderator, admin | `{ user, history }` (latest 50 log entries about the member) |
| POST | `/users/:id/warn` | moderator, admin | `{ reason }` → `{ user, history }` |
| POST | `/users/:id/suspend` | moderator, admin | `{ reason, days }` (1–90). `409` if banned |
| POST | `/users/:id/ban` | moderator, admin | `{ reason }`. `409` if already banned |
| POST | `/users/:id/reinstate` | moderator, admin | `{ reason }`. `409` if already active |
| PATCH | `/users/:id/role` | admin | `{ role, reason }`. `409` if unchanged |
| GET | `/log?cursor=&limit=` | moderator, admin | The whole log, newest first |

`403` for non-staff, for acting on yourself, and for a moderator acting on staff. Actions are limited to 60 per
15 minutes per staff member.

## Moderation

This module *is* the moderation tooling for accounts. Content reports and their queue live in the `moderation`
module and show here as the **Reports** tab (`/admin/moderation`).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_ADMIN` | off | Registers `/admin` routes and shows the Admin link to staff |

## Code map

- Backend: `apps/api/src/modules/admin/` (`AdminService`, `ModerationLogService` — exported for other modules)
- Auth changes: `SessionsService.revokeAllForUser()`, expired suspensions lifted in `AuthService.login()`
- Frontend: `apps/web/src/features/admin/` (`AdminMembers`, `AdminMemberDetail`, `ActionDialog`, `ModerationLogView`, `AdminNavLink`)
- Pages: `apps/web/src/app/(app)/admin`, `admin/users/[id]`, `admin/log`
- Schemas: `packages/shared/src/admin/`
- Seed: `apps/api/prisma/seed/admin.ts` (sample warnings and a running suspension)
- Tests: `apps/api/src/modules/admin/admin.service.spec.ts`, `apps/api/test/admin.e2e-spec.ts`, `apps/web/e2e/admin.spec.ts`

## Known limitations / future work

- An expired suspension is lifted only when the member logs in; until then they stay hidden in the directory.
- Emails to members are best effort: if sending fails, the action still stands and is logged.
- No bulk actions, and no way to correct a log entry other than adding a new one.
