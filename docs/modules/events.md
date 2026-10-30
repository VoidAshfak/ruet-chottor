# Events

The campus calendar: workshops, contests, seminars, cultural and sports events, month by month. Club managers put
their clubs' events on it; moderators and admins also add campus-wide ones. Members tap **I'm going**; organisers
see who is coming, and events with limited places show **Full** when taken.

**Status:** Done (Phase 3).
**Feature flag:** `FEATURE_EVENTS` (needs `FEATURE_AUTH`). Club events need `FEATURE_CLUBS` (and so
`FEATURE_ADMIN`); without clubs, staff still create campus-wide events. Posters need `CLOUDINARY_URL`; reporting
needs `FEATURE_MODERATION`.

## User flows

- A member opens **Events**: a month calendar in Dhaka time, weeks starting on Saturday (the Bangladeshi week).
  Wide screens show short titles in each day (and "+n more"); phones show a dot. Tapping a day lists its events,
  earliest first, under the calendar. Filters by category; `/events?club=<id>` (from a club page) shows one club's.
- An event page shows the poster, time ("26 Oct 2026, 3:45 PM – 5:45 PM"), venue, organising club, description
  and places taken. **I'm going** / **Not going any more**; "Full" when the capacity is reached; past and
  cancelled events take no RSVPs.
- **Create event** (club managers and staff): title, category, organiser (one of your clubs, or campus-wide for
  staff), start and end (entered as Dhaka time), venue, description, optional places and poster.
- Organisers (the creator, the club's managers and staff) **Edit**, **Cancel event** (confirmed; it stays on the
  calendar, struck through and marked "Cancelled") and see **Who is going**.
- Anyone can **Report** an event; moderators hide or remove it from the Reports queue.

## Roles & permissions

| Action | Member | The club's manager | moderator / admin |
|---|---|---|---|
| See the calendar and events, RSVP | ✅ | ✅ | ✅ |
| Create events for a club | ❌ | ✅ (own clubs) | ✅ (any club) |
| Create campus-wide events | ❌ | ❌ | ✅ |
| Edit, cancel, see attendees | the creator | ✅ | ✅ |

Checked in `EventsService` from the database. Suspended members cannot organise or RSVP.

## Data model

See the `// ===== events =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Event**: `title` (5–120), `category`, `description`, `venue`, `startsAt`, `endsAt` (at most 14 days long),
  `clubId` (clubs module; null for campus-wide), `capacity` (null for no limit), `createdById`, `status`
  (`visible | hidden | removed`, from moderation), `cancelledAt`.
- **EventRsvp**: `eventId` + `userId`, `createdAt`.
- The poster is a `MediaAsset` with purpose `events.poster` (one image).

## API

All paths start with `/api/v1/events` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/?from=&to=&clubId=&category=` | member | Visible events overlapping the range (at most 62 days; up to 300 events) |
| GET | `/:id` | member | One event (organisers also get moderated ones) |
| POST | `/` | club manager, staff | `{ title, category, description, venue, startsAt, endsAt, clubId, capacity, posterId }` (20 per hour; cannot start in the past) |
| PATCH | `/:id` | organisers | Same body; capacity cannot go below the people already going |
| POST | `/:id/cancel` | organisers | Marks it cancelled |
| POST | `/:id/rsvp` | member | Going → the event (`409` when full; `400` if cancelled or over) |
| DELETE | `/:id/rsvp` | member | Not going any more → the event |
| GET | `/:id/attendees` | organisers | `{ items: [{ id, name, roll, since }] }` |

Times are ISO instants. The web app reads `datetime-local` inputs as Dhaka time (`fromDhakaLocal` in
`packages/shared/src/common/dates.ts`); Bangladesh has no daylight saving, so Dhaka is always UTC+6.

## Moderation

`events.event` is registered with the moderation registry (`events-moderation.ts`). Hidden or removed events leave
the calendar and are served only to their organisers and staff (marked `moderated`). Rate limits: 20 new events and
60 edits per organiser per hour; 60 RSVP changes per member per hour.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_EVENTS` | off | Registers `/events` routes and shows **Events** |

## Code map

- Backend: `apps/api/src/modules/events/` (`EventsService`, `EventsController`, `EventsModeration`)
- Frontend: `apps/web/src/features/events/` (`EventsCalendar`, `EventDetail`, `EventForm`; `calendar.ts` holds the
  month-grid arithmetic)
- Pages: `apps/web/src/app/(app)/events`, `events/new`, `events/[id]`, `events/[id]/edit`
- Schemas: `packages/shared/src/events/`; Dhaka helpers in `packages/shared/src/common/dates.ts`
- Seed: `apps/api/prisma/seed/events.ts` (four events around the seed date; the Demo Student is going to one)
- Tests: `apps/web/src/features/events/calendar.spec.ts`, `packages/shared/src/common/dates.spec.ts`,
  `apps/api/test/events.e2e-spec.ts`, `apps/web/e2e/events.spec.ts`

## Known limitations / future work

- No reminders or change notices to people going (needs `notifications`).
- No recurring events and no "add to calendar" (.ics) export yet.
