# 0007 — Moderation log in `admin`, account status on `User`

**Status:** Accepted · 2026-10-30

## Context

CLAUDE.md §7 asks for an append-only `ModerationLog` and lets moderators warn, suspend or ban members. The
`add-moderation` skill sketches shared `ModerationLog`, `UserSanction` and `Report` models inside a
`moderation` module. Phase 1 builds the admin panel base, but not content reports, and CLAUDE.md forbids building
several modules in one change.

## Decision

- **`ModerationLog` lives in the `admin` module** and is written only through `ModerationLogService`
  (exported). Field names follow the skill (`moderatorId`, `action`, `targetUserId`, `contentType`, `contentId`,
  `reason`, `details`), so the future `moderation` module records content actions in the same table.
- **Append-only is enforced by the database**: a trigger (in the `add_admin` migration) rejects every `UPDATE`
  and `DELETE` on `moderation_logs`. The service has no update or delete method either.
- **No `UserSanction` table.** The current account state stays on `User` (`status`, plus a new `suspendedUntil`),
  which auth already checks. The history of warnings, suspensions and bans is the log itself.
- A temporary suspension is **lifted at the next login** after `suspendedUntil`; no scheduler is needed.
- Every action re-reads the acting moderator's role and status from the database, so a demoted or suspended
  moderator cannot keep acting with a still-valid 15-minute access token.

## Alternatives considered

- **Build the `moderation` module now**: two modules in one change, and reports have no content to report yet.
- **`UserSanction` table**: duplicates what `User.status` and the log already say; auth would need a second check.
- **Append-only by convention only**: easy to break by a future `prisma.moderationLog.update()`.

## Consequences

- When `moderation` is built, it imports `AdminModule` for `ModerationLogService` and adds new
  `ModerationAction` values (e.g. `hide_content`) with a migration.
- Fixing a wrong log entry means adding a new entry that explains it; old entries cannot be edited.
- A suspended member whose time is up stays hidden from the directory until they log in again.
