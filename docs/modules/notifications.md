# Notifications

An in-app inbox that tells members what happened to their things while they were away: a moderator's decision on
their post, a club answering their join request, an event they are going to moving or being cancelled. A bell in the
header shows the unread count and updates live.

**Status:** Done (Phase 7). In-app only; no email and no per-category settings yet.
**Feature flag:** `FEATURE_NOTIFICATIONS` (needs `FEATURE_AUTH`).

## User flows

- A logged-in member sees a **bell** next to their initials, with the number of unread notifications. It updates by
  itself (Socket.IO) when something new arrives or another tab marks them read.
- Tapping the bell opens **Notifications** (`/notifications`), newest first, 20 at a time ("Show older" loads more).
  Unread ones are highlighted. Tapping one marks it read and opens the post, club or event; one without a link (for
  example removed content) has a **Mark as read** button. **Mark all as read** clears the count.
- Notifications older than 90 days are deleted.

## What sends a notification

Other modules call `NotificationsService.notify()`. Nobody is told about their own action.

| Type | Sent by | Who gets it | When |
|---|---|---|---|
| `clubs.manager_appointed` | clubs | the new manager | An admin creates a club or changes its managers |
| `clubs.join_requested` | clubs | the club's managers | A member asks to join |
| `clubs.join_approved` | clubs | the member | A manager approves the request |
| `news.approved` / `news.rejected` | news | the author | A moderator reviews their post (a rejection includes the reason) |
| `events.changed` | events | everyone going | The organiser changes the time or venue (not the title or description) |
| `events.cancelled` | events | everyone going | The organiser cancels the event |
| `moderation.hidden` | moderation | the author | A moderator hides their content, or it was hidden automatically after several reports |
| `moderation.removed` | moderation | the author | A moderator removes it (no link: it is gone for the author too) |
| `moderation.restored` | moderation | the author | A moderator restores it, or dismisses the reports on an automatically hidden item (this is also how a held marketplace listing is approved) |

Moderation notifications include the moderator's reason but never who reported the item. The link comes from the
content type's `ModeratableItem.link` (ADR 0009).

## Roles & permissions

| Action | Any logged-in member |
|---|---|
| See, count and mark read **their own** notifications | ✅ |
| See anyone else's | ❌ (`404`, so ids cannot be probed) |

Notifications are written only by the server, never by members, so there is nothing to report or moderate.

## Data model

See the `// ===== notifications =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Notification**: `userId`, `type` (one of `NOTIFICATION_TYPES` in `packages/shared`), `title` (max 120),
  `body` (max 300, optional), `link` (a path in the web app, optional), `readAt`, `createdAt`.
  Indexed by `(userId, createdAt)` for the list and `(userId, readAt)` for the count.

## API

All paths start with `/api/v1/notifications` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/?cursor=&limit=` | Your notifications, newest first |
| GET | `/unread-count` | `{ count }` |
| POST | `/:id/read` | Marks one read; returns it. `404` if it is not yours |
| POST | `/read-all` | Marks all read. `204` |

## Real time

Namespace `/notifications`, server → client only. Sockets log in with the session cookie and join their own
`user:<id>` room; the server closes a socket soon after its session ends.

| Event | Payload | Meaning |
|---|---|---|
| `notifications:notification:new` | `{ notification }` | A new notification was saved for you |
| `notifications:read:changed` | `{}` | Read state changed (another tab or device) |

Notifications are saved before they are pushed. The browser treats both events as "refetch": after a reconnect it
refetches the list and count over HTTP, so nothing is missed.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_NOTIFICATIONS` | off | Registers `/notifications` routes and socket, shows the bell. Other modules send nothing while it is off |

## Code map

- Backend: `apps/api/src/modules/notifications/` (`NotificationsService` — exported, `notify()` —
  `NotificationsController`, `NotificationsGateway`, `NotificationsRealtime`)
- Senders: `ClubsService`, `NewsService`, `EventsService`, `ModerationService` inject it as `@Optional()`; their
  modules import `NotificationsModule` only when `notificationsOn()`
- Frontend: `apps/web/src/features/notifications/` (`NotificationBell`, `NotificationsInbox`, `NotificationItem`,
  `use-notifications-socket.ts`)
- Page: `apps/web/src/app/(app)/notifications`
- Schemas and types: `packages/shared/src/notifications/`; events in `packages/shared/src/socket-events.ts`
- Seed: `apps/api/prisma/seed/notifications.ts` (three for the Demo Student)
- Tests: `apps/api/src/modules/notifications/notifications.service.spec.ts`,
  `apps/api/test/notifications.e2e-spec.ts`, `apps/web/e2e/notifications.spec.ts`

## Known limitations / future work

- **In-app only.** No email or push notifications; a member who never opens the site does not hear anything.
- **No settings.** Members cannot mute a kind of notification yet.
- **No event reminders** ("starts in an hour"): that needs a scheduler, which the API does not have.
- Old notifications are cleaned up when a member receives a new one, not on a timer.
- One API instance only, like chat (see [deployment.md](../deployment.md)).
