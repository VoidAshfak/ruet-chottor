# CLAUDE.md — RUET Chottor

Instructions for working on this repository. Read this file fully before making changes.
The original brief is in `docs/proposal/project-idea.txt`; the approved scope is in `docs/proposal/RUET-Chottor-Project-Proposal.pdf`.
If something here conflicts with those, this file wins (it is kept up to date), but flag the conflict to the user.

---

## 1. What we are building

**RUET Chottor** ("chottor" = campus square) is an open-source web platform for students of
Rajshahi University of Engineering & Technology (RUET). It replaces scattered Facebook/WhatsApp
groups with one place to find people, talk in real time, and use campus services.

It is **not** a course-management tool. Google Classroom already does that; never build grading,
assignments, or course content features.

### Product principles (non-negotiable)

1. **Function over decoration.** Clean, minimal UI. Every screen must be simple, effective and fast.
2. **Self-explaining.** There is no marketing, so every feature explains itself (see §8).
3. **Safe by default.** Every piece of user-generated content can be reported and moderated (see §7).
4. **Incremental.** Features ship one module at a time. Never build several modules in one change.
5. **Modular.** A module can be added, changed or removed without touching other modules (see §4).
6. **Open source.** Code and docs must be understandable by a new RUET student contributor.

---

## 2. Current status & roadmap

Update this table whenever a phase changes state. Work only on the current phase unless the user says otherwise.

| Phase | Module(s) | Status |
|---|---|---|
| 0 | Repo scaffold, tooling, CI, base layout, theme, docs skeleton | ✅ Done |
| 1 | Auth (sign-up, login, 2FA), user profiles, contact directory, admin panel base | ✅ Done |
| 2 | Real-time messaging (1:1 and group chat), with message reports (`moderation`) | ✅ Done |
| 3 | News; clubs & events | ✅ Done |
| 4 | Lost & found; campus marketplace | ✅ Done |
| 5 | Bus schedule (live tracker later, once a location source exists) | ✅ Done (timetable; live tracker not started) |
| 6 | Hardening, testing, documentation pass | ⬜ Not started |

Status values: ⬜ Not started · 🟨 In progress · ✅ Done.
The admin panel grows with every phase: each new module adds its own moderation views.

---

## 3. Tech stack

Decided defaults. Do not add, replace or remove a core dependency without asking the user first.

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere (`strict: true`), ES modules in every workspace |
| Monorepo | pnpm 10 workspaces, Node 24 (`.nvmrc`) |
| Frontend | Next.js 16 (App Router, Cache Components on) + React 19, Tailwind CSS 4 |
| UI primitives | shadcn/ui (Radix based) — accessible tooltips, dialogs, popovers |
| Client data | TanStack Query |
| Forms & validation | React Hook Form + Zod (schemas shared with backend) |
| Backend | NestJS 12 (one Nest module per feature module) |
| Database | PostgreSQL via Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`; URL in `prisma.config.ts`) |
| Real-time | Socket.IO (NestJS gateways), Redis adapter when scaling |
| Cache / rate limiting / OTP store | Redis |
| Password hashing | argon2 |
| Email | Nodemailer (SMTP); provider configurable via env |
| SMS | Pluggable `SmsProvider` interface; disabled by default (costs money) |
| File uploads | Cloudinary (free tier), signed direct uploads from the browser via `core/media` `MediaService` (ADR 0010, `docs/media.md`) |
| Maps | Leaflet + OpenStreetMap |
| Testing | Vitest (unit), Supertest (API e2e), Playwright (web e2e) |
| Lint / format | ESLint + Prettier |
| Dev services | Hosted free tiers: Neon (PostgreSQL), Upstash (Redis). No Docker (ADR 0002) |

Next.js 16 differs from older versions: read the bundled guides in `apps/web/node_modules/next/dist/docs/`
before writing web code (see `apps/web/AGENTS.md`).

Before using any library API you are not 100% sure about, fetch current docs via Context7 (`resolve-library-id` → `query-docs`). Versions change; do not rely on memory.

---

## 4. Repository layout

```
ruet-chottor/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   └── src/
│   │       ├── app/            # routes only; thin, delegate to features/
│   │       ├── features/       # one folder per module (mirrors api modules)
│   │       │   └── <module>/   # components/, hooks/, api.ts, help.ts, index.ts
│   │       ├── components/     # shared UI: ui/ = shadcn primitives, guide/ = PageHeader,
│   │       │                   #   InfoTip, FirstVisitGuide; layout/ = header, footer
│   │       ├── lib/            # api-client.ts, modules.ts (nav registry), use-features.ts, utils
│   │       └── styles/theme.css  # the ONLY place colors are defined
│   │   ├── e2e/                # Playwright tests (desktop + mobile)
│   │   └── .env.example        # copy to .env.local
│   └── api/                    # NestJS backend
│       ├── prisma.config.ts    # Prisma CLI config: DB URL, migrations path, seed command
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed/           # index.ts + one seed file per module
│       ├── src/
│       │   ├── app.setup.ts    # HTTP setup shared by main.ts and e2e tests
│       │   ├── core/           # config, http (error filter), prisma, redis, meta (health/features)
│       │   ├── generated/      # Prisma client output (git-ignored, regenerated by build/test)
│       │   └── modules/
│       │       └── <module>/   # <module>.module.ts, controller, service, gateway?, dto/, *.spec.ts
│       ├── test/               # API e2e tests (*.e2e-spec.ts)
│       └── .env.example        # copy to .env
├── packages/
│   └── shared/                 # Zod schemas, shared types, constants, socket event names (built to dist/)
├── docs/
│   ├── architecture.md
│   ├── getting-started.md
│   ├── contributing.md
│   ├── modules/<module>.md     # one doc per module
│   ├── decisions/NNNN-title.md # architecture decision records
│   └── proposal/               # original brief and approved proposal
├── .claude/skills/             # project skills (see §13)
├── .github/                    # CI workflow, PR template
├── eslint.config.mjs           # lint config for api + shared (web has its own)
├── CHANGELOG.md
└── CLAUDE.md
```

ES modules: in `apps/api` and `packages/shared`, relative imports must end in `.js` (`'./foo.js'`).
`packages/shared` is compiled to `dist/`; the root `dev`, `typecheck` and `test` scripts build it first.

### Module boundary rules

- A module owns its folder in `apps/api/src/modules/<module>`, `apps/web/src/features/<module>`,
  its schemas in `packages/shared/src/<module>`, its seed file and its doc in `docs/modules/<module>.md`.
- Modules **never import each other's internals**. Cross-module calls go through the other module's
  exported service (backend) or `index.ts` public API (frontend).
- Shared logic goes to `core/` (backend), `lib/` or `components/` (frontend), or `packages/shared`.
- Each module can be switched off with a feature flag in config (`FEATURE_<MODULE>=true|false`).
  When off, its routes, nav items and socket events are not registered.
- Prisma models for a module are grouped under a `// ===== <module> =====` comment in `schema.prisma`.

Module names (use exactly these): `auth`, `users`, `directory`, `chat`, `news`, `clubs`, `events`,
`lost-found`, `marketplace`, `bus`, `moderation`, `admin`, `notifications`.

---

## 5. Commands

Run from the repo root (Windows + PowerShell or Git Bash both work). Keep this list accurate.

```
pnpm install                 # install all workspaces
pnpm dev                     # build shared, then run shared (watch) + web :3000 + api :4000
pnpm build                   # production build of every workspace
pnpm lint                    # eslint across workspaces
pnpm typecheck               # tsc --noEmit across workspaces
pnpm test                    # unit tests + API e2e tests (no database needed)
pnpm format                  # prettier --write (CI runs format:check)
pnpm --filter web e2e        # Playwright; once: pnpm --filter web exec playwright install chromium
pnpm --filter api prisma migrate dev --name <change>   # create + apply a migration (needs DIRECT_URL)
pnpm --filter api db:seed    # load dummy data
```

A change is not done until `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
API health check: `GET http://localhost:4000/api/v1/health`.

---

## 6. Authentication & accounts

Spec from the brief. Do not change without the user's approval.

- **Sign-up fields:** name, roll, registration number, email, phone, date of birth, password. All required.
  - Roll and registration number are unique. Email and phone are unique.
  - Validate roll format with a single shared Zod schema in `packages/shared` (RUET roll, e.g. `1703103`).
  - Password: minimum 8 characters; check against a common-password list.
- **Login:** roll + password, then a 6-digit one-time code (2FA) sent to email (default) or phone (if SMS enabled).
  - OTP: stored hashed in Redis, expires in 5 minutes, max 5 attempts, resend cooldown 60 s.
  - Login and OTP endpoints are rate-limited per IP and per roll.
- **Sessions:** short-lived access token + rotating refresh token, both in `httpOnly`, `secure`, `sameSite=lax` cookies. Never put tokens in localStorage.
- **Roles:** `student`, `alumni`, `teacher`, `club_manager`, `moderator`, `admin`. Use role guards on the backend;
  the frontend only hides UI and is never the security boundary.
- **Privacy:** each user chooses which contact fields (email, phone) are visible in the directory. Default: hidden.
  Date of birth is never shown publicly.
- Never log passwords, OTPs, tokens or full phone numbers.

---

## 7. Moderation (applies to every module)

Keeping the platform clean, non-violent, spam-free and free of misinformation is a core feature.

Every module that stores user-generated content (posts, messages, listings, comments, events) must:

1. Let any user **report** an item (reason + optional note) via the shared `moderation` module.
2. Store a `status` field: `visible | hidden | removed`. Hidden/removed content is not served to normal users.
3. Expose a moderation view in the admin panel for that content type (list reports, hide, remove, restore).
4. Record every moderator action in an append-only `ModerationLog` (who, what, when, why).
5. Apply rate limits on content creation to slow down spam.
6. Let moderators warn, temporarily suspend, or ban a user.

News posts must come from verified accounts (moderator/admin/club_manager) or pass moderator review before going live.
Use the `add-moderation` skill when adding a content type.

---

## 8. User guidance (no marketing, so the UI explains itself)

Every feature must include all three layers:

1. **Short description** — one sentence under each page title saying what the page is for.
2. **Info tips** — an `(i)` icon (`<InfoTip>` component) next to any non-obvious field, button or setting.
   Shows on hover (desktop) and on tap (mobile). Max ~25 words, plain language.
3. **First-time intro** — a short popup (`<FirstVisitGuide>`) the first time a user opens a module:
   2–4 steps, skippable, never shown again once dismissed (stored per user on the server, not only localStorage).

All guidance text for a module lives in `apps/web/src/features/<module>/help.ts`, never inline in components,
so it can be reviewed and translated in one place. Use the `add-user-guidance` skill.

---

## 9. UI & design rules

- Minimal and clean: white/light surfaces, generous spacing, one accent color, no gradients or decorative imagery.
- **Colors come from the RUET logo** and are defined only as CSS variables in `apps/web/src/styles/theme.css`
  (mapped to Tailwind via `@theme`). Never hard-code hex values in components.
  Palette (ADR 0003): `primary` = RUET blue (buttons, links, active), `accent` = light-blue tint (hover/selected),
  `brand-orange` = decoration only (fails contrast for text), `brand-green` = success states.
- Do not show the RUET emblem in the UI: this is a student project, not an official university service.
- Mobile first. Every page must work at 360 px width. Most students use phones.
- Accessible: semantic HTML, labels on every input, keyboard navigation, visible focus, contrast ≥ 4.5:1.
- Every list has empty, loading and error states. Every destructive action asks for confirmation.
- Dates shown in Asia/Dhaka time, format `26 Oct 2026, 3:45 PM`.

---

## 10. Real-time conventions

- One Socket.IO namespace per real-time module (`/chat`, `/notifications`, `/bus`).
- Socket connections authenticate with the same session cookie; reject unauthenticated sockets.
- Event names live in `packages/shared/src/socket-events.ts` as constants, format `<module>:<action>`
  (e.g. `chat:message:new`). Never use string literals for event names in app code.
- Payloads are validated with Zod on the server, exactly like HTTP bodies.
- Messages are persisted to Postgres first, then broadcast. The socket is a delivery channel, not the source of truth.
- Clients must handle reconnects and fetch missed data over HTTP after reconnecting.

---

## 11. Coding conventions

- TypeScript `strict`. No `any` unless commented with the reason.
- Validate all input at the boundary (Zod / DTOs). Never trust the client.
- Files: `kebab-case.ts`; React components `PascalCase.tsx`; one component per file.
- Backend: controllers are thin; business logic in services; database access only through Prisma in services.
- API routes: REST, plural nouns, `/api/v1/<module>/...`. Errors return `{ error: { code, message } }`.
- Pagination: cursor-based for feeds and chat; `?cursor=&limit=` (default 20, max 100).
- Config only from environment variables, validated at startup (`apps/api/src/core/config/env.ts`).
  Every new variable goes into the app's `.env.example` with a comment.
- Element `id`s must be unique across the whole app, not just the page: Next.js keeps previous pages mounted but
  hidden, so a repeated `id` makes a label point at the wrong input. Prefix ids with the feature or page
  (`login-roll`, `lf-board-category`).
- Client components must render the same output on the server and on the first client render
  (no hydration mismatches): read browser-only state via `useSyncExternalStore` or `useHydrated()`.
- No secrets, real student data, or real phone numbers/emails in the repo — ever.
- Comments explain *why*, not *what*. Keep them sparse.

---

## 12. Testing, docs and git

**Testing** — every module ships with:
- unit tests for service logic, API e2e tests for each endpoint (happy path + auth failure + validation failure),
- at least one Playwright test for the module's main user flow.

**Documentation** (open source, so this is part of "done"):
- `docs/modules/<module>.md` from the template in the `write-module-docs` skill.
- Update `docs/architecture.md` when structure changes; add an ADR in `docs/decisions/` for any significant technical decision.
- Add an entry to `CHANGELOG.md` (Keep a Changelog format) under `Unreleased`.
- Update the roadmap table in §2 of this file.

**Dummy data** — all initial data is fake or taken from public web sources (e.g. public RUET bus routes, department names).
Use the `seed-dummy-data` skill. Fake people must have obviously fake names/emails (`@example.com`) and phone numbers.

**Git:**
- Branches: `feat/<module>-<short-desc>`, `fix/...`, `docs/...`, `chore/...`.
- Conventional Commits: `feat(chat): add group creation`. One logical change per commit.
- Only commit or push when the user asks.

---

## 13. Project skills

Located in `.claude/skills/`. Use them — they hold the detailed checklists.

| Skill | Use when |
|---|---|
| `add-feature-module` | Starting any new module from the roadmap (scaffolds api + web + shared + seed + docs) |
| `add-user-guidance` | Adding descriptions, `(i)` info tips and first-visit intros to a feature |
| `add-moderation` | A module stores user-generated content that must be reportable/moderated |
| `add-realtime-feature` | Adding a Socket.IO namespace or event |
| `seed-dummy-data` | Creating or updating fake/public seed data |
| `write-module-docs` | Writing or updating a module's documentation |
| `security-review-checklist` | Before finishing any change that touches auth, user data, uploads or permissions |

---

## 14. Definition of done (every change)

- [ ] Scoped to one module / one concern; no unrelated edits
- [ ] Module boundary rules respected (§4)
- [ ] Input validated, permissions checked on the backend
- [ ] Moderation hooks in place for any user-generated content (§7)
- [ ] Description, info tips and first-visit guide present (§8)
- [ ] Works on mobile width, has empty/loading/error states (§9)
- [ ] Tests added and `pnpm lint && pnpm typecheck && pnpm test` pass
- [ ] Docs, `.env.example`, CHANGELOG and roadmap (§2) updated

## 15. Never

- Build course-management features (Google Classroom handles that).
- Store passwords or OTPs in plain text, or tokens in localStorage.
- Show phone, email or date of birth publicly by default.
- Use real student data in seeds, tests or screenshots.
- Hard-code colors, event names, or guidance text inside components.
- Add a new core dependency or change the stack without asking.
- Build several roadmap modules in a single change.
