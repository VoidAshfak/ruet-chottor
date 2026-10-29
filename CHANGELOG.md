# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
