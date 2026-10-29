---
name: add-feature-module
description: Scaffold and build a new RUET Chottor feature module (e.g. chat, news, clubs, lost-found, marketplace, bus) across api, web, shared, seed and docs, following the module boundary rules. Use when starting any module from the roadmap in CLAUDE.md.
---

# Add a feature module

Build exactly **one** module per run. Confirm the module name is in the list in CLAUDE.md §4 and is the
current roadmap phase (§2). If not, ask the user before continuing.

## 1. Plan first (show the user before coding)

Write a short plan covering:
- User stories (who does what, e.g. "a student posts a lost item with a photo").
- Data models and relations (Prisma).
- API endpoints (`/api/v1/<module>/...`) with method, auth/role required, request/response shape.
- Socket events, if real-time (then also follow `add-realtime-feature`).
- Pages/routes on the web app.
- Which content is user-generated (→ `add-moderation`).
- Roles and permissions.
- Feature flag name: `FEATURE_<MODULE>`.

Wait for the user's OK if the plan involves new dependencies or changes to other modules.

## 2. Shared package — `packages/shared/src/<module>/`

- `schemas.ts`: Zod schemas for every request body and response DTO. Export inferred types.
- Add socket event constants to `packages/shared/src/socket-events.ts` if needed.
- Re-export from `packages/shared/src/index.ts`.

## 3. Backend — `apps/api/src/modules/<module>/`

```
<module>.module.ts
<module>.controller.ts      # thin: validate, call service, return
<module>.service.ts         # business logic, Prisma access
<module>.gateway.ts         # only if real-time
dto/                        # Nest DTOs wrapping shared Zod schemas
<module>.service.spec.ts
<module>.e2e-spec.ts
```

- Add Prisma models under `// ===== <module> =====` in `schema.prisma`; run
  `pnpm --filter api prisma migrate dev --name add-<module>`.
- Every content model gets `status` (`visible|hidden|removed`), `createdById`, `createdAt`, `updatedAt`.
- Guard every route: authenticated by default; add role guards where needed.
- Register the module in `app.module.ts` only when `FEATURE_<MODULE>` is true.
- Add new env vars to `.env.example` with comments.

## 4. Frontend — `apps/web/src/features/<module>/`

```
components/      # module UI
hooks/           # TanStack Query hooks (use<Thing>, useCreate<Thing>)
api.ts           # typed calls using shared schemas
help.ts          # ALL guidance text (see add-user-guidance)
index.ts         # public exports — the only file other code may import
```

- Routes in `apps/web/src/app/(app)/<module>/` stay thin and render feature components.
- Add the nav item behind the feature flag.
- Every list: empty, loading, error states. Every destructive action: confirm dialog.
- Mobile first (360 px). Colors only from theme tokens.

## 5. Cross-cutting (required)

- `add-user-guidance` → description, `(i)` tips, first-visit intro.
- `add-moderation` → if any user-generated content.
- `seed-dummy-data` → `apps/api/prisma/seed/<module>.ts`.
- `write-module-docs` → `docs/modules/<module>.md`.
- `security-review-checklist` → before finishing.

## 6. Tests

- Service unit tests for business rules.
- API e2e: happy path, unauthenticated (401), wrong role (403), invalid input (400) for each endpoint.
- One Playwright test for the main flow.

## 7. Finish

- Run `pnpm lint && pnpm typecheck && pnpm test`; fix everything.
- Update `CHANGELOG.md` (Unreleased) and the roadmap table in CLAUDE.md §2.
- Report to the user: what was built, what was skipped and why, how to try it locally.
