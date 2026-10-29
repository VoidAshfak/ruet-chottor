---
name: seed-dummy-data
description: Create or update RUET Chottor seed data - obviously fake people plus public campus facts (departments, halls, bus routes, clubs) - as one idempotent seed file per module. Use when a module needs development or demo data.
---

# Seed dummy data

Initial data is dummy, or taken from public web sources. **Never** use real student personal data.

## Rules

- One file per module: `apps/api/prisma/seed/<module>.ts`, exporting `seed<Module>(prisma)`.
  `seed/index.ts` calls them in dependency order (users → directory → clubs → events → ...).
- Idempotent: use `upsert` on stable keys so running `pnpm --filter api db:seed` twice does not duplicate data.
- Deterministic: use `@faker-js/faker` with a fixed seed (`faker.seed(2026)`), Bangladeshi locale where available.
- Fake people:
  - realistic Bangladeshi names are fine, but emails must be `@example.com`,
  - phone numbers in a clearly fake range (e.g. `+880170000XXXX`),
  - rolls follow the real format (series + department code + serial) but are fake.
- Fixed demo accounts (document them in `docs/getting-started.md`), password `Password123!`:
  - `admin` (roll 0000001), `moderator` (0000002), `club_manager` (0000003), `student` (1703999), `teacher`, `alumni`.
- Public facts (department names, residential halls, campus landmarks, bus routes and stops, well-known clubs)
  may come from public RUET web pages. Put the source URL in a comment above the data. If unsure whether
  something is accurate, mark it `// TODO verify` rather than inventing details.
- Images: use placeholders from `apps/api/prisma/seed/assets/` (generated or royalty-free), never real photos of people.
- Include varied states: some content `HIDDEN`, some open reports, resolved lost-found items, expired events,
  so every UI state can be seen in development.
- Keep volumes small (tens to low hundreds of rows) so seeding is fast.

## Check

- [ ] Running the seed twice gives the same result
- [ ] No real emails, phone numbers or personal data
- [ ] Sources noted for public facts
- [ ] Demo accounts listed in `docs/getting-started.md`
