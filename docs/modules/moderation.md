# Moderation

Reports on user-generated content and the staff queue that reviews them (CLAUDE.md §7). Members report what is
wrong; moderators hide, remove, restore or dismiss, and every action lands in the append-only moderation log owned by
[admin](admin.md). Content modules plug in through a small registry in `core`, so this module never imports their
internals ([ADR 0009](../decisions/0009-moderatable-content-registry.md)).

**Status:** Done for chat messages (Phase 2). Each later content module registers its own type.
**Feature flag:** `FEATURE_MODERATION` (needs `FEATURE_ADMIN`, which owns the moderation log, and `FEATURE_AUTH`)

## User flows

- A member opens a message's **Report** button, picks a reason (spam, harassment, violence, misinformation,
  inappropriate, scam, other), optionally adds a note and sends it. The button then reads "You reported this".
  The author is never told who reported.
- When `MODERATION_AUTO_HIDE_REPORTS` different members (default 5) have open reports on an item, it is hidden
  automatically and stays at the top of the queue. The log records this as done "automatically".
- A moderator opens **Admin → Reports**. The queue lists open reports, the most-reported items first, then the
  longest waiting. "Acted on" and "Dismissed" show closed reports.
- The moderator opens an item: the reported text, its author (linked to their admin page to warn, suspend or ban),
  every report with its reporter and note, and the actions already taken. Only the reported item is shown, never the
  rest of a private conversation.
- **Hide** or **Remove** closes the open reports as "acted on". **Restore** makes the item visible again.
  **Dismiss reports** closes them as "dismissed", and puts an automatically hidden item back. Every action needs a
  reason.
- The author of a hidden or removed message sees "Hidden by a moderator" in its place; everyone else no longer
  sees it at all.

## Roles & permissions

| Action | Any member | moderator | admin |
|---|---|---|---|
| Report content they can see (not their own) | ✅ | ✅ | ✅ |
| Open the queue, view an item and its reports | ❌ | ✅ | ✅ |
| Hide, remove, restore, dismiss | ❌ | ✅ | ✅ |

Staff routes use `@Roles('moderator', 'admin')`, and the service checks the role again in the database. Whether a
member "can see" an item is decided by the content module (for chat: they are in the conversation and joined before
the message was sent). Reporting something you cannot see gets the same `404` as something that does not exist.

## Data model

See the `// ===== moderation =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Report**: `contentType` (e.g. `chat.message`), `contentId`, `reporterId`, `reason`, `note`,
  `status` (`open | actioned | dismissed`), `resolvedById`, `resolvedAt`. Unique per
  `(contentType, contentId, reporterId)`.
- Content keeps its own `status` (`visible | hidden | removed`), e.g. `Message.status` in chat.
- Log actions added to admin's `ModerationAction`: `hide_content`, `remove_content`, `restore_content`,
  `dismiss_reports`. Automatic hides use `moderatorId = 00000000-0000-0000-0000-000000000000` and
  `details.auto = true`.

## API

All paths start with `/api/v1/moderation`. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| POST | `/reports` | member | `{ contentType, contentId, reason, note? }` → `204`. `409` if you already reported it, `400` for your own content, `404` if you cannot see it |
| GET | `/reports/mine?contentType=&ids=a,b` | member | `{ reportedIds }`: which of these (up to 100) you reported |
| GET | `/queue?status=&contentType=&cursor=&limit=` | moderator, admin | Reported items with counts and reasons |
| GET | `/items/:contentType/:contentId` | moderator, admin | `{ item, reports, history }` |
| POST | `/items/:contentType/:contentId/:action` | moderator, admin | `action` = `hide | remove | restore | dismiss`, body `{ reason }` → the updated item. `409` if it makes no sense in the current state |

Limits: 20 reports per member per hour, 120 staff actions per 15 minutes.

## Adding a content type

1. Add its key to `MODERATABLE_CONTENT_TYPES` in `packages/shared/src/moderation/schemas.ts`.
2. In the content module, implement `ModeratableContent` (`canReport`, `load`, `setStatus`, `label`) and register it
   in `onModuleInit`. See `apps/api/src/modules/chat/chat-moderation.ts`.
3. Serve only `visible` items to normal users (authors may see their own hidden ones, without the text).
4. Put `<ReportAction>` (from `@/features/moderation`) on each item, with `useReportedIds()` for "You reported this".
5. Add a label in `features/admin/help.ts` (`logLine.contentLabels`).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_MODERATION` | off | Registers `/moderation` routes (only together with `FEATURE_ADMIN`), shows Report buttons and the Reports tab |
| `MODERATION_AUTO_HIDE_REPORTS` | `5` | Different members' open reports that hide an item automatically |

## Code map

- Backend: `apps/api/src/modules/moderation/` (`ModerationService`, `ModerationController`)
- Registry: `apps/api/src/core/moderation/moderatable-content.registry.ts`
- Chat adapter: `apps/api/src/modules/chat/chat-moderation.ts`
- Frontend: `apps/web/src/features/moderation/` (`ReportAction`, `ReportDialog`, `ModerationQueue`,
  `ModerationItemDetail`, `ContentActionDialog`)
- Pages: `apps/web/src/app/(app)/admin/moderation`, `admin/moderation/[contentType]/[contentId]`
- Schemas: `packages/shared/src/moderation/`
- Seed: `apps/api/prisma/seed/moderation.ts` (one reported demo spam message in the thesis group)
- Tests: `apps/api/src/modules/moderation/moderation.service.spec.ts`, `apps/api/test/moderation.e2e-spec.ts`,
  `apps/web/e2e/moderation.spec.ts`

## Known limitations / future work

- The queue groups reports in memory (all reports with the chosen status). Fine for a campus; switch to a SQL
  `GROUP BY` if open reports reach the thousands.
- Members are not notified when their content is hidden, apart from the note on the item (needs `notifications`).
- Group names are not reportable yet; only messages.
- No appeal flow.
