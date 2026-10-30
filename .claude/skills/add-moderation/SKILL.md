---
name: add-moderation
description: Wire a RUET Chottor content type (posts, messages, listings, events, comments) into the shared moderation system - reporting, status, admin views, audit log, rate limits. Use whenever a module stores user-generated content.
---

# Add moderation to a content type

Goal: keep the platform clean, non-violent, spam-free and free of misinformation.
The shared `moderation` module owns reports and logs; content modules plug into it.

## 1. Data model

On the content model:
```prisma
status      ContentStatus @default(VISIBLE)   // VISIBLE | HIDDEN | REMOVED
createdById String
```
Reuse the `ContentStatus` enum (defined in the chat section). Shared models already exist:
- `Report` (moderation section): one per reporter per item; `status` open | actioned | dismissed.
- `ModerationLog` (admin section, ADR 0007): append-only, enforced by a database trigger. Write it through admin's
  exported `ModerationLogService`.
- Account sanctions are `User.status` + `suspendedUntil` (ADR 0007); there is no `UserSanction` table.

Report reasons (shared enum): `spam`, `harassment`, `violence`, `misinformation`, `inappropriate`, `scam`, `other`.

## 2. Register the content type

Add the content type key (e.g. `marketplace.listing`) to `MODERATABLE_CONTENT_TYPES` in
`packages/shared/src/moderation/schemas.ts`, then implement `ModeratableContent` from
`core/moderation/moderatable-content.registry.ts` in the content module and register it in `onModuleInit`
(example: `apps/api/src/modules/chat/chat-moderation.ts`, ADR 0009):
- `canReport(userId, id)`: only people who can see the item,
- `load(id)`: preview, author, status, short context, for review (only the item, never its surroundings),
- `setStatus(id, status)`: also tell open clients,
- `label` for the admin UI, plus `logLine.contentLabels` in `features/admin/help.ts`.

This way the moderation module never imports the content module's internals.

## 3. Serving rules

- Normal users get only `VISIBLE` items. Authors also see their own `HIDDEN` items with a "hidden by moderator" note.
- `REMOVED` items are returned to no one except moderators/admins.
- Suspended/banned users cannot create content (check in a shared guard).

## 4. Reporting UI

- Every item gets `<ReportAction>` from `@/features/moderation` (dialog with reason + optional note and an
  `<InfoTip>` saying reports are anonymous to the author). Pass `reported` from `useReportedIds()`, which batches
  the "You reported this" lookup for a whole list.

## 5. Admin panel

The shared queue at `/admin/moderation` (moderation module) already covers every registered type:
- open reports sorted by number of reports, then age; item page at `/admin/moderation/<contentType>/<id>`,
- preview of the item and author (link to the author's admin page to warn/suspend/ban),
- actions: dismiss, hide, remove, restore — each requires a reason and writes a `ModerationLog` row.
Registering the type (step 2) is all a content module needs.

Only `moderator` and `admin` roles can access it (backend guard).

## 6. Spam protection

- Rate-limit creation endpoints (e.g. 10 posts/hour/user; chat stricter per minute). Put limits in config.
- Auto-hiding after `MODERATION_AUTO_HIDE_REPORTS` unique reports (default 5) is done by the moderation module.
- For news: posts from non-verified roles start as `HIDDEN` until a moderator approves them.

## 7. Tests

- Reported item appears in the queue; duplicate report rejected.
- Hidden/removed items are not returned to normal users.
- Non-moderators get 403 on admin endpoints.
- Every moderator action creates a log entry.
