# RUET Chottor

**RUET Chottor** ("chottor" = campus square) is an open-source web platform for students of
Rajshahi University of Engineering & Technology. It brings the things students currently scatter across
Facebook and WhatsApp groups into one place: finding people, talking in real time, and using campus services.

> Status: **early development.** The project foundation (Phase 0) is in place; features arrive one at a time.

## Planned sections

| Section | What it does | Status |
|---|---|---|
| Accounts | Sign up with roll and registration number, log in with a one-time code | Planned (Phase 1) |
| Directory | Find students, alumni and teachers; you choose what contact info is visible | Planned (Phase 1) |
| Messages | One-to-one and group chat in real time | Planned (Phase 2) |
| News, Clubs & Events | Campus news, club pages and an events calendar | Planned (Phase 3) |
| Lost & Found, Marketplace | Return lost items; buy and sell used items within RUET | Planned (Phase 4) |
| Bus | Bus routes and schedules | Planned (Phase 5) |

Every section is moderated: anyone can report harmful, false or spam content, and moderators review it.
Course management is out of scope; Google Classroom already does that well.

## Tech stack

TypeScript monorepo (pnpm workspaces): **Next.js** web app, **NestJS** API, **PostgreSQL** with **Prisma**,
**Redis**, **Socket.IO** for real time. Full details and reasons are in [docs/architecture.md](docs/architecture.md).

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Web app: http://localhost:3000 · API: http://localhost:4000/api/v1/health

See [docs/getting-started.md](docs/getting-started.md) for the full setup, including free database and Redis accounts.

## Contributing

RUET students are welcome to contribute. Start with [docs/contributing.md](docs/contributing.md).
The rules every change follows are in [CLAUDE.md](CLAUDE.md).

## License

[MIT](LICENSE)
