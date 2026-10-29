# 0004 — Development email through Ethereal

**Status:** Accepted · 2026-10-29

## Context

Login sends a 6-digit code by email. Without Docker (ADR 0002) there is no local mail catcher such as Mailpit,
and contributors should not need a real SMTP account to work on the app. CLAUDE.md §6 also forbids logging codes.

## Decision

- `MailService` (Nodemailer) sends through `SMTP_URL` when it is set.
- In development without `SMTP_URL`, it creates a throwaway [Ethereal](https://ethereal.email) inbox
  (`nodemailer.createTestAccount()`) and logs only the **preview link** of each message. Open the link to read the code.
- `SMTP_URL` is required in production (startup fails without it), so the Ethereal path can never run there.
- Tests replace `MailService` with an in-memory fake.

## Alternatives considered

- **Log the code to the console** — simplest, but breaks the "never log OTPs" rule and is easy to copy into production.
- **A dev-only "outbox" page** — extra code and an endpoint that must never ship.
- **A real SMTP provider (Brevo, Gmail)** — needs an account and secrets for every contributor.

## Consequences

- Development needs internet access to send login emails (it already needs it for Neon and Upstash).
- The preview link gives access to that one message, so API logs from development should not be shared publicly.
- For production, pick any SMTP provider and set `SMTP_URL` and `MAIL_FROM`.
