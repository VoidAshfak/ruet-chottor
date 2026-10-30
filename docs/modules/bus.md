# Bus

The university bus timetable: routes, stops and trips, the next buses from any stop, and notices for temporary
changes. Admins keep it up to date in the admin panel. Live tracking comes later, once there is a location source on
the buses.

**Status:** Done (Phase 5, timetable). Live tracker: not started.
**Feature flag:** `FEATURE_BUS` (needs `FEATURE_AUTH`).

> The seed adds **placeholder** routes ("Route A (demo)", "Route B (demo)") with made-up times. Enter the official
> RUET timetable in **Admin → Bus** before launch.

## User flows

- A member opens **Bus**: notices in force today at the top, then **Next buses**: pick a stop and see the next
  departures today with a countdown ("11:55 PM · in 12 min · Route A · From campus"), refreshed every 30 seconds.
  Then the list of routes.
- A route page shows its stops in order on a coloured line with travel times ("+20 min"), and the full timetable in
  both directions with the days each trip runs ("Sat–Thu", "Friday", "Every day").
- An admin opens **Admin → Bus**:
  - **New route / Edit**: name, colour, description, running (shown to members) or not, stops from campus outwards with
    minutes from campus (reorder, add, remove), and trips (direction, time, weekdays, note). Saving replaces the whole
    route at once.
  - **Notices**: for one route or all, with first and last day; delete with confirmation.

## How times work

Each stop records **minutes from campus**; the first stop is campus (0). A trip has a direction and the time it
leaves its first stop: campus for "from campus", the furthest stop for "to campus". The time at any stop is that
departure plus the travel time from the first stop (`departuresFrom()` in `packages/shared/src/bus/schemas.ts`).
A trip's last stop is where it ends, so it is not shown as a departure there. All times are Dhaka time; weekdays are
JavaScript's (0 = Sunday), shown Saturday first.

## Roles & permissions

| Action | Member | moderator | admin |
|---|---|---|---|
| See routes, timetables, next buses, notices | ✅ | ✅ | ✅ |
| Create, edit, delete routes; post and delete notices | ❌ | ❌ | ✅ |
| See inactive routes and all notices (`?all=true`) | ❌ | ❌ | ✅ |

Admin routes use `@Roles('admin')`, and the role is checked again from the database. Members write nothing here, so
there is no reporting.

## Data model

See the `// ===== bus =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **BusRoute**: `name` (unique), `description`, `color` (`blue | orange | green | red | purple | teal`, mapped to
  `--route-*` theme tokens), `active`.
- **BusStop**: `routeId`, `name`, `position`, `minutesFromCampus`.
- **BusTrip**: `routeId`, `direction` (`from_campus | to_campus`), `departMinutes` (after midnight), `days`
  (weekdays), `note`.
- **BusNotice**: `routeId` (null for all routes), `message`, `startsOn`, `endsOn` (dates), `createdById`.

## API

All paths start with `/api/v1/bus` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/routes?all=` | member (`all`: admin) | Running routes with stops and trips |
| GET | `/routes/:id` | member | One route (inactive ones for admins only) |
| POST | `/routes` | admin | `{ name, description, color, active, stops: [{ name, minutesFromCampus }], trips: [{ direction, departsAt "HH:MM", days, note }] }` |
| PUT | `/routes/:id` | admin | Same body; replaces stops and trips |
| DELETE | `/routes/:id` | admin | Deletes the route with its stops, trips and notices |
| GET | `/notices?all=` | member (`all`: admin) | Notices in force today (Dhaka) |
| POST | `/notices` | admin | `{ routeId, message, startsOn, endsOn }` |
| DELETE | `/notices/:id` | admin | |

Admin edits are limited to 120 per hour.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_BUS` | off | Registers `/bus` routes and shows **Bus** and **Admin → Bus** |

## Code map

- Backend: `apps/api/src/modules/bus/` (`BusService`, `BusController`)
- Frontend: `apps/web/src/features/bus/` (`BusHome`, `RouteDetail`, `AdminBus`, `RouteEditor`; `schedule.ts` for
  Dhaka time and day labels)
- Pages: `apps/web/src/app/(app)/bus`, `bus/[id]`, `admin/bus`, `admin/bus/new`, `admin/bus/[id]`
- Schemas and `departuresFrom()`: `packages/shared/src/bus/`
- Seed: `apps/api/prisma/seed/bus.ts` (placeholder routes)
- Tests: `packages/shared/src/bus/schemas.spec.ts`, `apps/web/src/features/bus/schedule.spec.ts`,
  `apps/api/test/bus.e2e-spec.ts`, `apps/web/e2e/bus.spec.ts`

## Known limitations / future work

- **Live tracker**: needs a location source (GPS devices or drivers' phones). It would use a `/bus` Socket.IO
  namespace (CLAUDE.md §10).
- Times are from the timetable; there are no delay updates.
- "Next buses" shows today only; after the last bus of the day it says so rather than showing tomorrow's first bus.
