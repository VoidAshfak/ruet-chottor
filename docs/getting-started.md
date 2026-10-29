# Getting started

This guide takes you from a fresh clone to a running app. It assumes Windows, macOS or Linux with a terminal.

## 1. Install the tools

| Tool | Version | Check |
|---|---|---|
| Node.js | 22 or newer (24 recommended, see `.nvmrc`) | `node -v` |
| pnpm | 10 | `pnpm -v` |
| Git | any recent | `git --version` |

Install pnpm with `npm install -g pnpm@10` (or `corepack enable pnpm` if you have admin rights).

## 2. Install dependencies

```bash
pnpm install
```

## 3. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The app **starts without a database or Redis**: the health endpoint then reports them as `not_configured`.
That is enough for working on the UI. Features that store data (from Phase 1 on) need both.

### Free PostgreSQL with Neon

1. Create a free account at [neon.tech](https://neon.tech) and create a project (region: Singapore is closest to Bangladesh).
2. Open **Connect**. Copy the **pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`.
3. Turn pooling off and copy the **direct** connection string into `DIRECT_URL`. Prisma migrations need it.

### Free Redis with Upstash

1. Create a free account at [upstash.com](https://upstash.com) and create a Redis database (region: Singapore).
2. Copy the **TCP** URL, which starts with `rediss://`, into `REDIS_URL`. Do not use the REST URL.

Never commit `.env` files. They are already in `.gitignore`.

## 4. Run the app

```bash
pnpm dev
```

- Web app: http://localhost:3000
- API health: http://localhost:4000/api/v1/health — should show `"database": "up"` and `"redis": "up"` once configured.

## 5. Turn sections on

Each section is behind a feature flag in `apps/api/.env`, for example `FEATURE_CHAT=true`.
Restart the API after changing flags. Sections whose flag is off show as "Coming soon".

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + API with hot reload |
| `pnpm lint` | ESLint everywhere |
| `pnpm typecheck` | TypeScript checks everywhere |
| `pnpm test` | Unit + API end-to-end tests |
| `pnpm --filter web e2e` | Browser tests (run `pnpm --filter web exec playwright install chromium` once first) |
| `pnpm format` | Format all code with Prettier |
| `pnpm --filter api prisma migrate dev --name <change>` | Create and apply a database migration |
| `pnpm --filter api db:seed` | Load dummy data |
| `pnpm --filter api prisma studio` | Browse the database in your browser |

## Demo accounts

Added in Phase 1 by the seed script. They will be listed here.

## Troubleshooting

- **`pnpm` not found after installing:** open a new terminal so `PATH` refreshes.
- **Health shows `"database": "down"`:** check `DATABASE_URL`, and that the Neon project is not suspended (open it in the Neon console to wake it).
- **Port already in use:** change `PORT` in `apps/api/.env`, or stop the other process.
