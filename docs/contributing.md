# Contributing

Thanks for helping build RUET Chottor. This page explains how to make a change that gets merged quickly.
You do not need to know the whole codebase: most changes touch one module.

## Before you start

1. Set up the project with [getting-started.md](getting-started.md) and log in with a demo account.
2. Read [CLAUDE.md](../CLAUDE.md). It has the product rules, folder layout and coding conventions every change follows.
3. Check the roadmap (CLAUDE.md §2). Work on the current phase unless a maintainer agrees otherwise.
4. For anything bigger than a small fix, open an issue first and say what you plan to do. It saves you from
   building something that cannot be merged.

## Find your way around

Every section of the app is a **module** with the same shape in four places:

| Where | What is there |
|---|---|
| `packages/shared/src/<module>/` | Zod schemas for requests and responses, used by both the API and the web app |
| `apps/api/src/modules/<module>/` | NestJS module: controller (thin), service (the rules), moderation hooks |
| `apps/web/src/features/<module>/` | React components, TanStack Query hooks, `api.ts`, and `help.ts` (all guidance text) |
| `docs/modules/<module>.md` | What the module does, who may do what, its API and data model |

Start from the module doc: it ends with a **Code map** listing the files. Pages in `apps/web/src/app/` are thin and
only render feature components. Modules never import each other's internals: they go through an exported service
(API) or the module's `index.ts` (web). [architecture.md](architecture.md) has the full picture.

## Making a change

1. Update your `main` and create a branch: `feat/<module>-<short-desc>`, `fix/...`, `docs/...` or `chore/...`.
2. Keep the change to **one module or one concern**.
3. Add tests (CLAUDE.md §12):
   - a unit test for a new rule in a service,
   - API e2e tests for each new endpoint: it works, it needs a login (401), the wrong role is refused (403), bad
     input is refused (400),
   - a Playwright test when the main flow of a page changes.
4. Run the checks:
   ```bash
   pnpm format && pnpm lint && pnpm typecheck && pnpm test
   ```
5. Update the docs: the module doc, `CHANGELOG.md` (under *Unreleased*), and `.env.example` if you added a variable.
6. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(chat): add group creation`,
   `fix(events): show Full on the calendar`, `docs(bus): explain trip days`.
7. Open a pull request and fill in the checklist. Add mobile and desktop screenshots for UI changes (fake data only).

## Running tests

| What | Command | Notes |
|---|---|---|
| Everything except browser tests | `pnpm test` | No database or Redis needed: the API tests use in-memory fakes (`apps/api/test/fakes/`) |
| One API test file | `pnpm --filter api exec vitest run --config vitest.config.e2e.ts test/chat.e2e-spec.ts` | |
| Browser tests | `pnpm --filter web e2e` | Run `pnpm --filter web exec playwright install chromium` once. They mock the API, so it need not run |

Next.js allows only one dev server per folder. If `pnpm dev` is already running, the browser tests reuse it on
port 3000. To test a production build instead, build and start it on another port, then point the tests at it:

```bash
pnpm --filter web build
pnpm --filter web exec next start -p 3100     # in a second terminal
E2E_PORT=3100 pnpm --filter web e2e
```

When you add a field to the database, the in-memory fake usually needs nothing. When a service uses a new Prisma
method, add it to `fake-prisma.ts` and keep it behaving like Prisma.

## Common mistakes (and how to avoid them)

- **Repeated element ids.** Next.js keeps earlier pages mounted but hidden, so two pages with `id="roll"` make a
  label point at the wrong input. Prefix ids with the feature: `login-roll`, `lf-board-category`.
- **Hydration mismatches.** A component must render the same on the server and on the first client render. Read
  browser-only things (time, `localStorage`, window size) with `useSyncExternalStore` or `useHydrated()`.
- **Imports without `.js`** in `apps/api` and `packages/shared`. They are ES modules: write `'./foo.js'`.
- **Colors in components.** Use theme classes (`bg-primary`, `text-muted-foreground`); colors live only in
  `apps/web/src/styles/theme.css`.
- **Text in components.** Page descriptions, (i) tips and first-visit guides go in the module's `help.ts`.
- **Socket event names as strings.** Use the constants in `packages/shared/src/socket-events.ts`.
- **Trusting the client.** Hiding a button is not a permission check. The API checks roles and ownership itself.
- **Dates.** Show them in Dhaka time with the shared helpers (`26 Oct 2026, 3:45 PM`), never the browser's zone.
- **Forgetting moderation.** Anything members post needs reporting and a `status` (use the `add-moderation` skill).

## Ground rules

- **No real personal data**, ever: not in seed data, tests, screenshots or issues. Use `@example.com` emails and
  obviously fake names and phone numbers.
- **No secrets in the repo.** Configuration comes from `.env` files, which are git-ignored.
- **Every feature explains itself:** page description, (i) info tips, first-visit guide.
- **Every user-generated content type is reportable and moderated.**
- **Ask before adding a dependency.** Say why the existing stack cannot do it.
- **Be kind in reviews.** Many contributors are writing their first pull request.

## Using Claude Code

The repo includes project skills in `.claude/skills/` (for example `add-feature-module`, `add-moderation`,
`write-module-docs`). Claude Code picks them up automatically and follows CLAUDE.md.
