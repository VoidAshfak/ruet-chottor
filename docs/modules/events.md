# Events

The campus calendar: workshops, contests, seminars, cultural and sports events, month by month. Club managers put
their clubs' events on it; moderators and admins also add campus-wide ones; verified class representatives (CRs)
propose **class events**, which a moderator approves first. Members tap **I'm going**; organisers see who is
coming, and events with limited places show **Full** when taken.

**Status:** Done (Phase 3); class events added in Phase 8.
**Feature flag:** `FEATURE_EVENTS` (needs `FEATURE_AUTH`). Club events need `FEATURE_CLUBS` (and so
`FEATURE_ADMIN`); without clubs, staff still create campus-wide events. Posters need `CLOUDINARY_URL`; reporting
needs `FEATURE_MODERATION`. Class events need `FEATURE_USERS` and `FEATURE_ADMIN` (CR verification, and
reviews in the moderation log).

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
- **Class events:** a verified CR picks "My class: CSE 2021 · Section A" as the organiser (the class is fixed from
  their CR status). The form says class events are for meetings, farewells, tours and get-togethers, not tests or
  assignments (no course management, CLAUDE.md §1). The event waits off the calendar, visible only to the CR and
  staff, until a moderator or admin **approves** it or **turns it down** with a reason in **Admin → Event review**.
  Approved class events show for everyone, labelled with the class. A CR's edit sends the event back to review;
  when it is approved again, the people going are told it changed. A CR who steps down keeps their events and can
  still cancel them, but cannot create or edit class events.

## Roles & permissions

| Action | Member | The club's manager | moderator / admin |
|---|---|---|---|
| See the calendar and events, RSVP | ✅ | ✅ | ✅ |
| Create events for a club | ❌ | ✅ (own clubs) | ✅ (any club) |
| Create campus-wide events | ❌ | ❌ | ✅ |
| Edit, cancel, see attendees | the creator | ✅ | ✅ |
| Propose class events (need approval) | verified CRs (own class) | verified CRs | verified CRs |
| Approve or turn down class events | ❌ | ❌ | ✅ (not their own) |

Checked in `EventsService` from the database. Suspended members cannot organise or RSVP.

## Data model

See the `// ===== events =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Event**: `title` (5–120), `category`, `description`, `venue`, `startsAt`, `endsAt` (at most 14 days long),
  `clubId` (clubs module; null for campus-wide), `capacity` (null for no limit), `createdById`, `status`
  (`visible | hidden | removed`, from moderation), `cancelledAt`, `review` (`pending | approved | rejected`;
  everything except class events is `approved` at once), `reviewNote`, `reviewedById`, `reviewedAt`,
  `approvedAt` (first approval), and for class events `classDepartment` (code), `classSeries`, `classSection`,
  copied from the CR's roll and verified section when the event is created.
- **EventRsvp**: `eventId` + `userId`, `createdAt`.
- The poster is a `MediaAsset` with purpose `events.poster` (one image).

## API

All paths start with `/api/v1/events` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/?from=&to=&clubId=&category=` | member | Visible, approved events overlapping the range (at most 62 days; up to 300 events) |
| GET | `/review?cursor=&limit=` | moderator, admin | Class events waiting for review, oldest first |
| GET | `/:id` | member | One event (organisers also get moderated, pending and rejected ones) |
| POST | `/` | club manager, staff, verified CR | `{ title, category, description, venue, startsAt, endsAt, clubId, capacity, posterId, forClass }` (20 per hour; cannot start in the past). `forClass: true` (with `clubId: null`) makes a class event that waits for review |
| PATCH | `/:id` | organisers | Same body; capacity cannot go below the people already going; `forClass` cannot change. A CR's edit of a class event goes back to review |
| POST | `/:id/approve` | moderator, admin | Puts a waiting class event on the calendar (`403` on your own, `404` if not waiting) |
| POST | `/:id/reject` | moderator, admin | `{ reason }` → turns it down; the CR sees the reason |
| POST | `/:id/cancel` | organisers | Marks it cancelled |
| POST | `/:id/rsvp` | member | Going → the event (`409` when full; `400` if cancelled or over) |
| DELETE | `/:id/rsvp` | member | Not going any more → the event |
| GET | `/:id/attendees` | organisers | `{ items: [{ id, name, roll, since }] }` |

Times are ISO instants. The web app reads `datetime-local` inputs as Dhaka time (`fromDhakaLocal` in
`packages/shared/src/common/dates.ts`); Bangladesh has no daylight saving, so Dhaka is always UTC+6.

## Moderation

`events.event` is registered with the moderation registry (`events-moderation.ts`). Hidden or removed events leave
the calendar and are served only to their organisers and staff (marked `moderated`). Rate limits: 20 new events and
60 edits per organiser per hour; 60 RSVP changes per member per hour; 120 reviews per staff member per 15 minutes.

Class event reviews are written to the moderation log as `approve_content` / `reject_content` on
`events.event`, in the same transaction as the decision, and the CR is notified (`events.approved`,
`events.rejected`).

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_EVENTS` | off | Registers `/events` routes and shows **Events** |

## Code map

- Backend: `apps/api/src/modules/events/` (`EventsService`, `EventsController`, `EventsModeration`)
- Frontend: `apps/web/src/features/events/` (`EventsCalendar`, `EventDetail`, `EventForm`, `AdminEventReview`;
  `calendar.ts` holds the month-grid arithmetic; `use-my-class.ts` asks the users module whether the viewer is a CR)
- Pages: `apps/web/src/app/(app)/events`, `events/new`, `events/[id]`, `events/[id]/edit`, `admin/events`
- CR status comes from the users module's exported `UsersService.classRepOf` (backend) and `useMyProfile`
  (frontend), never from its tables.
- Schemas: `packages/shared/src/events/`; Dhaka helpers in `packages/shared/src/common/dates.ts`
- Seed: `apps/api/prisma/seed/events.ts` (four events around the seed date, the Demo Student going to one; plus
  one approved and one waiting class event by the demo CR, Rafiq Fakeuddin)
- Tests: `apps/web/src/features/events/calendar.spec.ts`, `packages/shared/src/common/dates.spec.ts`,
  `apps/api/test/events.e2e-spec.ts`, `apps/api/test/class-events.e2e-spec.ts`, `apps/web/e2e/events.spec.ts`,
  `apps/web/e2e/class-events.spec.ts`

## Known limitations / future work

- No reminders yet (change and cancellation notices exist).
- A CR has no list of their own waiting or turned-down class events; they find them through the notification or
  the event link.
- Class events are visible to everyone; there is no "only my class" audience.
- No recurring events and no "add to calendar" (.ics) export yet.
