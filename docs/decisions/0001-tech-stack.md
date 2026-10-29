# 0001 — Tech stack

**Status:** Accepted · 2026-10-28

## Context

RUET Chottor must be feature-rich, real-time, modular, and maintainable by future RUET students who join and leave
every year. The project proposal listed React/Next.js, Node.js (Express or NestJS), PostgreSQL and Socket.IO.

## Decision

- **TypeScript** everywhere, in a **pnpm workspaces** monorepo (`apps/web`, `apps/api`, `packages/shared`).
- **Next.js 16** (App Router) + **Tailwind CSS 4** + **shadcn/ui** (Radix) for the web app.
- **NestJS 12** for the API. Chosen over Express because its module system matches our "one module per feature" rule
  and gives a consistent structure (controllers, services, guards, gateways) that new contributors can follow.
- **PostgreSQL** with **Prisma 7**: type-safe queries and readable migrations.
- **Redis** for rate limits, OTP codes, caching and the Socket.IO adapter.
- **Zod 4** schemas in `packages/shared`, used for validation on both sides.
- **Vitest** for unit/API tests and **Playwright** for browser tests.
- Both apps use **ES modules**, the default for new NestJS and Next.js projects.

## Alternatives considered

- **Express:** smaller, but every contributor would invent their own structure.
- **Next.js API routes only:** fewer moving parts, but long-lived Socket.IO connections and background work fit a
  separate server better.
- **oxlint** (the new NestJS default): faster, but we use ESLint in both apps for one consistent setup.

## Consequences

- One `pnpm install` sets up everything; shared schemas keep the web and API in sync.
- Contributors need to learn NestJS decorators and module patterns. The `add-feature-module` skill and module docs help.
