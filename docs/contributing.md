# Contributing

Thanks for helping build RUET Chottor. This page explains how to make a change that gets merged quickly.

## Before you start

1. Set up the project with [getting-started.md](getting-started.md).
2. Read [CLAUDE.md](../CLAUDE.md). It has the product rules, folder layout and coding conventions every change follows.
3. Check the roadmap (CLAUDE.md §2). Work on the current phase unless a maintainer agrees otherwise.

## Making a change

1. Create a branch: `feat/<module>-<short-desc>`, `fix/...`, `docs/...` or `chore/...`.
2. Keep the change to **one module or one concern**.
3. Add tests (see CLAUDE.md §12).
4. Run the checks:
   ```bash
   pnpm format && pnpm lint && pnpm typecheck && pnpm test
   ```
5. Update the docs: the module doc, `CHANGELOG.md` (under *Unreleased*), and `.env.example` if you added a variable.
6. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat(chat): add group creation`.
7. Open a pull request and fill in the checklist.

## Ground rules

- **No real personal data**, ever: not in seed data, tests, screenshots or issues. Use `@example.com` emails.
- **No secrets in the repo.** Configuration comes from `.env` files, which are git-ignored.
- **Every feature explains itself:** page description, (i) info tips, first-visit guide.
- **Every user-generated content type is reportable and moderated.**
- Ask before adding a new dependency.

## Using Claude Code

The repo includes project skills in `.claude/skills/` (for example `add-feature-module`, `add-moderation`).
Claude Code picks them up automatically and follows CLAUDE.md.
