# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Media uploads (shared infrastructure, ADR 0010): images, videos and documents stored in Cloudinary. The browser
  uploads directly with a signed, single-use ticket; the API checks the stored file's type and size before it can
  be attached to content, deletes rejected or abandoned files, and serves CDN-optimised URLs. `MediaUploader` and
  `MediaGallery` components for the web app. New env vars `CLOUDINARY_URL` and `MEDIA_FOLDER`.
- Moderation module (Phase 2): members report messages (reason + optional note, one report each, anonymous to the
  author); items are hidden automatically after `MODERATION_AUTO_HIDE_REPORTS` reports (default 5). Staff review the
  queue under **Admin → Reports**, see only the reported item, and hide, remove, restore or dismiss with a reason,
  all recorded in the moderation log. Senders see "Hidden by a moderator" on their own hidden messages. Content
  modules plug in through `ModeratableContentRegistry` in core (ADR 0009).
- Chat module (Phase 2): one-to-one and group chats (up to 50 members) with live delivery over Socket.IO,
  typing hints, unread counts and "Reconnecting…" with catch-up after a dropped connection. Group owners rename
  and manage members; anyone can leave. Senders can delete their own messages. Suspended members cannot send;
  sending is rate-limited (`CHAT_SEND_LIMIT_PER_MINUTE`). **Message** button on profiles and directory cards.
  Sample conversations in the seed. Message reporting comes with the moderation module.
- Real-time foundation: Socket.IO adapter limited to the web origin, cookie login for sockets, and a shared
  browser socket client (ADR 0008).
- Admin module (Phase 1, panel base): moderators and admins search all members, warn, suspend (1–90 days),
  ban and reinstate them; admins change roles. Every action needs a reason, is emailed to the member and is
  recorded in an append-only moderation log (enforced by a database trigger). Admin link for staff only.
- Auth: suspensions can end at a set time (`suspendedUntil`), are lifted at the next login after it, and the
  login error says until when; suspending or banning logs the member out everywhere.
- Shared `formatDateTime()` for the `26 Oct 2026, 3:45 PM` (Asia/Dhaka) date format.
- ADR 0007 (moderation log in `admin`, account status on `User`).
- Directory module (Phase 1): search members by name or roll, and filter by department, series and role.
  Results show only the contact details each member shares; filters are kept in the URL.
- Users module (Phase 1): **My profile** page and public member profiles (`/users/<id>`). Department and series
  are worked out from the roll (ADR 0006); email and phone are shown only if the member opts in (off by default).
  First-visit guides are now remembered on the server for logged-in members, with a "Show tips again" button.
  Profile link in the header. Demo accounts and fake members in the seed (`docs/getting-started.md`).
- Show/hide password button on the sign-up and login forms.
- Auth module (Phase 1): sign-up with roll, registration number, email, phone, date of birth and password;
  two-step login (password, then a 6-digit code by email); rotating sessions in `httpOnly` cookies; logout.
  Sign-up and login pages with info tips and a first-visit guide; Log in / Log out in the header.
- API: global auth guard (routes private by default, `@Public()`, `@Roles()`), Redis rate limiting,
  email via SMTP or an Ethereal test inbox in development, Zod validation pipe, CSRF origin check.
- Shared validation for RUET roll, Bangladeshi phone numbers, passwords (incl. a common-password list).
- ADR 0004 (development email) and ADR 0005 (opaque session tokens).

- Phase 0 project foundation: pnpm monorepo with `apps/web` (Next.js 16), `apps/api` (NestJS 12) and
  `packages/shared` (Zod schemas and constants).
- API: environment validation, `/api/v1` routing, standard `{ error: { code, message } }` responses,
  security headers, CORS, Prisma 7 (PostgreSQL) and Redis connections.
- API endpoints `GET /api/v1/health` and `GET /api/v1/features`.
- Feature flags (`FEATURE_<MODULE>`) shared by the API and web app.
- Web: app shell, theme based on the RUET logo colors (contrast-checked), home page listing all planned sections, and the user-guidance components
  `PageHeader`, `InfoTip` and `FirstVisitGuide`.
- Tests: Vitest unit tests, API e2e tests (Supertest), web e2e tests (Playwright, desktop and mobile).
- GitHub Actions CI, ESLint, Prettier, and project documentation.

### Fixed

- The global auth guard no longer runs on WebSocket events (gateways authenticate sockets themselves).
- Header and admin tab links no longer block prerendering on pages with a member id (`/users/<id>`,
  `/admin/users/<id>`); the active-link highlight is added on the client (shared `NavLink`).
