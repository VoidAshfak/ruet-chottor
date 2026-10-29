# 0002 — Hosted PostgreSQL and Redis for development

**Status:** Accepted · 2026-10-28

## Context

The original plan ran PostgreSQL, Redis and a mail catcher locally with Docker Compose. Docker is not installed on the
main developer's machine, and many student laptops struggle to run it.

## Decision

- Development uses free hosted services: **Neon** for PostgreSQL and **Upstash** for Redis.
- The API starts without either configured. `GET /api/v1/health` reports `not_configured`, so UI work needs no accounts.
- Prisma uses Neon's pooled `DATABASE_URL` at runtime and the direct `DIRECT_URL` for migrations.
- Each contributor creates their own free databases. Credentials are never shared or committed.

## Alternatives considered

- **Docker Compose:** the same environment for everyone, but a heavy install. It can be added later as an option.
- **Native installs of PostgreSQL and Redis:** Redis has no official Windows build.

## Consequences

- Development needs an internet connection once the database is in use.
- The mail catcher (Mailpit) is gone. When email sending is built in Phase 1, development needs another way to read
  outgoing mail, such as a log-to-file transport or a free SMTP sandbox. This will be decided then.
