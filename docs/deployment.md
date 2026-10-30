# Deployment

How to run RUET Chottor for real users: a **staging** copy for testing and a **production** copy for students.
For running it on your own machine, see [getting-started.md](getting-started.md).

The guide does not depend on a particular host. Anything that runs a Node.js 24 process works.

## What runs where

| Piece | What it is | Needs |
|---|---|---|
| Web (`apps/web`) | Next.js app | A Node.js host, or a Next.js host such as Vercel |
| API (`apps/api`) | NestJS server: HTTP **and** WebSockets (chat) | A **long-running** Node.js process. Serverless functions do not work: chat keeps sockets open |
| PostgreSQL | Neon (free tier is enough to start) | One database per environment |
| Redis | Upstash | One database per environment. Holds sessions, login codes and rate limits |
| Media | Cloudinary | One account; a folder per environment |
| Email | Any SMTP provider | Sends the login codes |

Keep staging and production fully apart: different databases, Redis, Cloudinary folders and secrets.

## 1. Pick domains (important)

Sessions live in `sameSite=lax` cookies set by the API (CLAUDE.md §6). The browser sends them only when the web
app and the API are on the **same site**, meaning the same registrable domain:

| Works | Does not work |
|---|---|
| `chottor.example.org` + `api.chottor.example.org` | `chottor.vercel.app` + `chottor-api.onrender.com` |
| `staging.chottor.example.org` + `api.staging.chottor.example.org` | Two different hosts' default domains |

So give both services custom subdomains of one domain. Hosts' default domains (`*.vercel.app`, `*.onrender.com`
and similar) count as separate sites, so login looks like it works but every later request is logged out.
Both must use HTTPS: the cookies are `secure`.

## 2. Create the services

1. **Neon**: create a project (region Singapore) or a branch per environment. Note the **pooled** URL
   (`-pooler` in the host) and the **direct** URL. Use `sslmode=verify-full` in both.
2. **Upstash**: create a Redis database (region Singapore). Use the `rediss://` TCP URL, not the REST one.
3. **Cloudinary**: copy the API environment variable (`cloudinary://...`). Pick a folder per environment, e.g.
   `ruet-chottor/staging` and `ruet-chottor/prod` (`MEDIA_FOLDER`). See [media.md](media.md).
4. **SMTP**: an account that can send from your domain, e.g. `smtps://user:pass@smtp.example.com:465`.

## 3. Configure the API

Set these on the API host. The full list with comments is in [`apps/api/.env.example`](../apps/api/.env.example).
The API checks them at startup and refuses to boot with a bad config.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Makes `DATABASE_URL`, `REDIS_URL`, `OTP_SECRET` and `SMTP_URL` required |
| `PORT` | the host's port | Many hosts set it for you |
| `WEB_ORIGIN` | `https://chottor.example.org` | Exact origin of the web app: CORS, the origin check and sockets use it |
| `TRUST_PROXY` | `1` | Hosts put a load balancer in front; without this every member shares one per-IP rate limit |
| `DATABASE_URL` | Neon **pooled** URL | |
| `DIRECT_URL` | Neon **direct** URL | Only for migrations (step 5) |
| `REDIS_URL` | Upstash `rediss://` URL | |
| `OTP_SECRET` | 32+ random characters | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_URL`, `MAIL_FROM` | your SMTP server and sender | |
| `CLOUDINARY_URL`, `MEDIA_FOLDER` | from step 2 | Without `CLOUDINARY_URL`, uploads are off and the rest works |
| `FEATURE_*` | `true` for each section to show | See the list in `.env.example`; mind each flag's "needs" |

Every secret is different per environment. Never reuse a development `OTP_SECRET` or copy `.env` files to a server.

## 4. Configure the web app

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.chottor.example.org/api/v1` | Set **before building**: it is built into the pages and the Content Security Policy |

The web app has no secrets. It asks the API which sections are on, so feature flags are set on the API only.

## 5. Build, migrate and start

Install with the lockfile, then build each service together with the shared package (`...` includes a package's
dependencies):

```bash
pnpm install --frozen-lockfile

# API
pnpm --filter api... build
pnpm --filter api prisma migrate deploy    # needs DIRECT_URL; applies new migrations only
pnpm --filter api start                    # node dist/main

# Web
pnpm --filter web... build
pnpm --filter web start                    # next start; honours PORT
```

- Run `prisma migrate deploy` on every release, **before** starting the new API version. Never run
  `migrate dev` or `migrate reset` against staging or production.
- Health check for the host: `GET /api/v1/health`. It answers `200` with `"status": "ok"` when the database and
  Redis are up, and `"degraded"` otherwise.

## 6. The first admin

The seed refuses to run in production, so there are no demo accounts. To get the first admin:

1. Sign up normally on the live site and log in once.
2. In the Neon SQL editor, promote that account:
   ```sql
   UPDATE users SET role = 'admin' WHERE roll = '<your roll>';
   ```
3. Log out and in again. From now on, make moderators and other admins in **Admin → Members**, which records
   every change in the moderation log. Use SQL only for this first account.

Then enter the real bus timetable in **Admin → Bus**, create the clubs, and appoint their managers.

## 7. Seed data policy

- **Development:** seed freely (`pnpm --filter api db:seed`).
- **Staging:** seeding is allowed, so testers have something to look at. Run it from your machine against the
  staging database (`DATABASE_URL` pointing at staging, `NODE_ENV` not `production`). Every demo account shares the
  published password `Password123!`, so a seeded staging site must not be open to real students.
- **Production:** never seed. The seed refuses when `NODE_ENV=production`.

## 8. Limits to know about

- **Run one API instance.** Chat delivers messages through Socket.IO inside one process. With two or more
  instances, members connected to different instances would not see each other's messages live (they would
  after a reload). Scaling out needs the Socket.IO Redis adapter (CLAUDE.md §10), which is not set up yet.
- **Free tiers sleep.** Neon suspends an idle database; the first request after a pause takes a few seconds.
- **Email deliverability:** set up SPF and DKIM for the sending domain, or login codes land in spam.

## Release checklist

- [ ] CI is green on `main`.
- [ ] Staging updated first: migrations applied, smoke test (sign up, log in with the code, send a chat message,
      upload an image).
- [ ] Production: `prisma migrate deploy`, then deploy the API, then the web app.
- [ ] `GET /api/v1/health` shows `"status": "ok"`.
- [ ] `CHANGELOG.md`: move *Unreleased* entries under the new version.
