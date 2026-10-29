---
name: write-module-docs
description: Write or update RUET Chottor open-source documentation - module docs from a fixed template, architecture notes, ADRs and CHANGELOG entries. Use after building or changing a module, or when the user asks for docs.
---

# Write module documentation

RUET Chottor is open source and will be maintained by future RUET students. Write for a second-year
CSE student who has never seen the codebase. Short sentences, concrete examples, no marketing language.

## 1. Module doc — `docs/modules/<module>.md`

Use this template exactly:

```markdown
# <Module name>

<One paragraph: what it does for users and why it exists.>

**Status:** <Not started | In progress | Released in vX.Y>
**Feature flag:** `FEATURE_<MODULE>`

## User flows
- <Role> can <action>. (one bullet per flow)

## Roles & permissions
| Action | student | alumni | teacher | club_manager | moderator | admin |
|---|---|---|---|---|---|---|

## Data model
<Prisma models with one line per important field. Link to schema.prisma section.>

## API
| Method | Path | Auth/role | Description |
|---|---|---|---|

## Real-time events
| Event | Direction | Payload |
|---|---|---|
(omit if none)

## Moderation
<What can be reported, auto-hide threshold, admin view path.>

## Configuration
| Env var | Default | Description |
|---|---|---|

## Code map
- Backend: `apps/api/src/modules/<module>/`
- Frontend: `apps/web/src/features/<module>/`
- Schemas: `packages/shared/src/<module>/`
- Seed: `apps/api/prisma/seed/<module>.ts`

## Known limitations / future work
```

## 2. Other docs to keep in sync

- `docs/architecture.md` — update if a module adds a new dependency, service, or cross-module interaction.
- `docs/getting-started.md` — new env vars, services, or demo accounts.
- `docs/decisions/NNNN-<title>.md` — an ADR for any significant choice (library, data design, security trade-off):
  Context, Decision, Alternatives considered, Consequences. Number sequentially.
- `CHANGELOG.md` — add under `## [Unreleased]` using Added / Changed / Fixed / Removed.
- `CLAUDE.md` §2 roadmap table — update the status.

## 3. Rules

- Docs must match the code. If you change an endpoint or env var, update the doc in the same change.
- Use relative links between docs.
- No screenshots with real personal data.
