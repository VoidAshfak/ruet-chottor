---
name: security-review-checklist
description: Security checklist for RUET Chottor changes touching auth, 2FA, user data, privacy settings, uploads, permissions, sockets or admin features. Run before finishing such a change and report any failed item to the user.
---

# Security review checklist

Go through every item that applies to the change. Fix failures; report anything you could not fix.

## Authentication & sessions
- [ ] Passwords hashed with argon2; never logged or returned in responses.
- [ ] OTP codes: random 6 digits, stored hashed, 5-minute expiry, max 5 attempts, 60 s resend cooldown, single use.
- [ ] Login, OTP verify, OTP resend and sign-up are rate-limited per IP and per roll.
- [ ] Login errors do not reveal whether a roll exists ("Roll or password is incorrect").
- [ ] Tokens only in `httpOnly`, `secure`, `sameSite=lax` cookies; refresh tokens rotate and are revoked on logout/password change.
- [ ] CSRF protection on state-changing requests that rely on cookies.

## Authorization
- [ ] Every endpoint and socket event checks authentication and role **on the server**.
- [ ] Ownership checked on update/delete (users can edit only their own content unless moderator/admin).
- [ ] IDs from the client are never trusted for access decisions (no IDOR).
- [ ] Suspended/banned users are blocked from creating content and sending messages.

## Personal data & privacy
- [ ] Email/phone visible only per the user's privacy settings; date of birth never public.
- [ ] API responses use explicit select/DTOs — no full user objects leaked (no password hash, no private fields).
- [ ] Logs contain no passwords, OTPs, tokens, full phone numbers.
- [ ] No real personal data in seeds, tests, fixtures or docs.

## Input & output
- [ ] All input validated with shared Zod schemas (body, query, params, socket payloads).
- [ ] User text rendered as text (no `dangerouslySetInnerHTML`); if rich text is ever allowed, sanitize server-side.
- [ ] Prisma queries only; no raw SQL with string interpolation.

## Uploads
- [ ] File type checked by content (magic bytes), not only extension; allow-list images only (jpg, png, webp).
- [ ] Size limit enforced (config, default 5 MB); images re-encoded/stripped of EXIF location data.
- [ ] Stored with random names outside the web root; served via `StorageService`.

## Configuration
- [ ] Secrets only in env vars; `.env` git-ignored; `.env.example` has placeholders only.
- [ ] CORS limited to the web app origin; security headers set (helmet).

## Moderation
- [ ] New user-generated content is reportable and respects `status` (see `add-moderation`).
- [ ] Admin actions are logged in `ModerationLog`.

Report: list each failed or not-applicable item with a one-line reason.
