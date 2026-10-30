# RUET Chottor

**RUET Chottor** ("chottor" = campus square) is an open-source web platform for students of
Rajshahi University of Engineering & Technology. It brings the things students currently scatter across
Facebook and WhatsApp groups into one place: finding people, talking in real time, and using campus services.

> Status: every planned section is built and hardened (Phases 0–7). Next: live bus tracking.
> This is a student project, not an official RUET service.

## What's inside

| Section | What you can do |
|---|---|
| **Accounts** | Sign up with your roll and registration number; log in with your password and a 6-digit code sent by email |
| **Profiles & Directory** | Find students, alumni and teachers by name, roll, department or series. You choose whether your email and phone are shown; both are hidden by default |
| **Messages** | One-to-one and group chat in real time, with unread counts and typing indicators |
| **News** | Campus news. Posts from staff and club managers go live at once; others wait for a moderator |
| **Clubs** | A page per club with its managers, members and news. Joining needs a manager's approval |
| **Events** | A month calendar of campus and club events; tap **I'm going** (some events have limited places) |
| **Lost & Found** | Post a lost or found item; found items can carry a check question, and photos stay blurred until tapped |
| **Marketplace** | Buy and sell within RUET, paying in person. Listings mentioning prohibited items wait for a moderator |
| **Bus** | Routes, stops and the full timetable, the next buses from your stop, and notices about changes |
| **Notifications** | A bell with an unread count: moderator decisions on your posts, club join requests, and changes to events you are going to |
| **Admin** | Staff review reports, hide or remove content, warn, suspend or ban members, and read the moderation log |

Every page explains itself: a one-line description, **(i)** tips next to anything unclear, and a short guide the
first time you open a section. Anything members post can be reported, and moderators act on reports.
Course management is out of scope; Google Classroom already does that well.

## Tech stack

TypeScript monorepo (pnpm workspaces): **Next.js** web app, **NestJS** API, **PostgreSQL** with **Prisma**,
**Redis**, **Socket.IO** for real time, **Cloudinary** for photos and videos.
How the pieces fit is in [docs/architecture.md](docs/architecture.md); the reasons are in [docs/decisions](docs/decisions).

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Web app: http://localhost:3000 · API: http://localhost:4000/api/v1/health

[docs/getting-started.md](docs/getting-started.md) has the full setup: free database and Redis accounts, feature
flags, and demo accounts for every role.

## Documentation

| Read this | When you want to |
|---|---|
| [Getting started](docs/getting-started.md) | Run the app on your machine |
| [Contributing](docs/contributing.md) | Make your first change |
| [Architecture](docs/architecture.md) | Understand how the code is organised |
| [Modules](docs/modules) | Learn how one section works: rules, API, data |
| [Deployment](docs/deployment.md) | Run staging or production |
| [CLAUDE.md](CLAUDE.md) | Check the rules every change follows |

## Contributing

RUET students are welcome to contribute. Start with [docs/contributing.md](docs/contributing.md).

## License

[MIT](LICENSE)
