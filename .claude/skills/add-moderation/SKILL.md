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
Shared models (create once in the `moderation` section if missing):
- `Report { id, contentType, contentId, reporterId, reason, note?, status (OPEN|ACTIONED|DISMISSED), createdAt, resolvedById?, resolvedAt? }`
- `ModerationLog { id, moderatorId, action, contentType?, contentId?, targetUserId?, reason, createdAt }` — append-only; never update or delete rows.
- `UserSanction { id, userId, type (WARNING|SUSPENSION|BAN), reason, expiresAt?, createdById, createdAt }`

Report reasons (shared enum): `spam`, `harassment`, `violence`, `misinformation`, `inappropriate`, `scam`, `other`.

## 2. Register the content type

Add the content type key (e.g. `marketplace.listing`) to the `ModeratableContent` registry in the
moderation module, with:
- a loader to fetch the item for review,
- a function to set its status,
- a short label for the admin UI.

This way the moderation module never imports the content module's internals.

## 3. Serving rules

- Normal users get only `VISIBLE` items. Authors also see their own `HIDDEN` items with a "hidden by moderator" note.
- `REMOVED` items are returned to no one except moderators/admins.
- Suspended/banned users cannot create content (check in a shared guard).

## 4. Reporting UI

- Every item gets a "Report" action (in its `...` menu) opening a dialog with reason + optional note.
- One report per user per item; show "You reported this" afterwards.
- Add an `<InfoTip>` explaining that reports are anonymous to the author.

## 5. Admin panel

Add a view for the content type under `/admin/moderation/<contentType>`:
- queue of open reports, sorted by number of reports, then age,
- preview of the item and author,
- actions: dismiss, hide, remove, restore, warn/suspend/ban author — each requires a reason,
- every action writes a `ModerationLog` row.

Only `moderator` and `admin` roles can access it (backend guard).

## 6. Spam protection

- Rate-limit creation endpoints (e.g. 10 posts/hour/user; chat stricter per minute). Put limits in config.
- Auto-hide an item once it reaches a configurable number of unique reports (default 5) and put it at the top of the queue.
- For news: posts from non-verified roles start as `HIDDEN` until a moderator approves them.

## 7. Tests

- Reported item appears in the queue; duplicate report rejected.
- Hidden/removed items are not returned to normal users.
- Non-moderators get 403 on admin endpoints.
- Every moderator action creates a log entry.
