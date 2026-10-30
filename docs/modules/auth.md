# Auth

Sign-up and login. A RUET student creates an account with their roll and registration number, then logs in
with roll + password followed by a 6-digit code sent to their email (two-step login). Sessions live in
`httpOnly` cookies, so the browser's JavaScript never sees a token.

**Status:** In progress (Phase 1)
**Feature flag:** `FEATURE_AUTH`

## User flows

- A visitor signs up with name, roll, registration number, email, phone, date of birth and password.
- A member logs in: roll + password → a 6-digit code is emailed → entering the code starts the session.
- A member can ask for a new code (after 60 s, at most 3 times per login).
- A member stays logged in across reloads; the session refreshes itself in the background.
- A member logs out, which ends the session on the server too.

## Roles & permissions

Everyone starts as `student`. Other roles are given by an admin (admin panel, later in Phase 1).

| Action | visitor | any logged-in role |
|---|---|---|
| Sign up, log in, verify code, resend code | ✅ | ✅ |
| Refresh session, log out | ✅ (needs the cookie) | ✅ |
| `GET /auth/session` | ❌ 401 | ✅ |

Roles are enforced on the server with `@Roles(...)` (see `apps/api/src/core/auth/decorators.ts`). Every route
is private unless marked `@Public()`.

## Data model

See the `// ===== auth =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **User:** `name`, `roll` (unique, 7 digits), `registrationNo` (unique), `email` (unique, lowercase),
  `phone` (unique, `+8801XXXXXXXXX`), `dateOfBirth` (never shown publicly), `passwordHash` (argon2id),
  `role`, `status` (`active | suspended | banned`), `suspendedUntil` (end of a temporary suspension).
- **Session:** one row per logged-in device. Stores only the SHA-256 hash of the current refresh token and of the
  one before it (to detect reuse), `expiresAt` (30 days, extended on every refresh), `revokedAt`.

Short-lived data lives in Redis, not Postgres:

| Key | What | Lifetime |
|---|---|---|
| `auth:access:<hash>` | Access token → `{ userId, sessionId, role }` | 15 min |
| `auth:session-access:<sessionId>` | Points at the session's live access token, so revoking the session deletes it | 15 min |
| `auth:otp:<hash>` | Login code challenge: HMAC of the code, user id, resend count | 5 min |
| `auth:otp:<hash>:attempts` / `:cooldown` | Wrong-code counter, resend cooldown | 5 min / 60 s |
| `ratelimit:auth:*` | Rate-limit counters | window length |

## API

All paths start with `/api/v1`. Errors use the standard `{ error: { code, message } }` shape.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | public | Create an account. `201 { user }`. `409` if roll, registration no., email or phone is taken |
| POST | `/auth/login` | public | Check roll + password and email a code. `200 { challengeId, channel, destination, expiresInSeconds, resendInSeconds }`. `401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED` |
| POST | `/auth/otp/verify` | public | `{ challengeId, code }` → sets the session cookies, `200 { user }`. `400 OTP_INVALID` / `OTP_EXPIRED` |
| POST | `/auth/otp/resend` | public | `{ challengeId }` → emails a new code. `429` during the cooldown |
| POST | `/auth/refresh` | refresh cookie | Rotates both tokens. `200 { user }` or `401` |
| POST | `/auth/logout` | cookies | Ends the session. `204` |
| GET | `/auth/session` | logged in | `200 { user }` — the current user. `401 SESSION_EXPIRED` means "refresh and retry" |

Rate limits (per 15 minutes unless noted): login 20 per IP and 10 per roll; code verify/resend 30 per IP;
sign-up 5 per IP and 5 per roll per hour. Each code allows 5 wrong tries.

### Cookies

| Cookie | Path | Lifetime | Flags |
|---|---|---|---|
| `rc_access` | `/` | 15 min | `httpOnly; secure; sameSite=lax` |
| `rc_refresh` | `/api/v1/auth` | 30 days | `httpOnly; secure; sameSite=lax` |

State-changing requests from another origin are refused (`403`), in addition to `sameSite=lax`
(`apps/api/src/core/http/origin-check.ts`).

## Moderation

Nothing user-generated is stored here except the user's name. Suspensions and bans are set by staff in the
[admin](admin.md) module. A suspended or banned user cannot log in or refresh a session; the login error says
until when a suspension lasts. A suspension whose `suspendedUntil` has passed is lifted at the next login.
`SessionsService.revokeAllForUser()` (exported) logs a member out everywhere when they are suspended or banned.
Revoking a session also deletes its access token, so the member is cut off at once.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_AUTH` | off | Registers the auth routes and shows Log in / Sign up in the header |
| `REDIS_URL` | — | Required: access tokens, codes and rate limits live in Redis |
| `DATABASE_URL` | — | Required: users and sessions |
| `OTP_SECRET` | random per run (dev) | HMAC key for login codes. Required in production |
| `SMTP_URL` | Ethereal (dev) | SMTP server for emails. Required in production ([ADR 0004](../decisions/0004-dev-email-ethereal.md)) |
| `MAIL_FROM` | `"RUET Chottor" <no-reply@example.com>` | Sender address |

## Code map

- Backend: `apps/api/src/modules/auth/` (controller, `AuthService`, `OtpService`, `SessionsService`)
- Shared backend pieces: `apps/api/src/core/auth/` (global `AuthGuard`, `@Public`, `@Roles`, `@CurrentUser`,
  cookies, access-token store), `core/rate-limit/`, `core/mail/`
- Frontend: `apps/web/src/features/auth/` (`SignupForm`, `LoginForm`, `OtpStep`, `AccountMenu`, `useSession`)
- Pages: `apps/web/src/app/(auth)/signup`, `apps/web/src/app/(auth)/login`
- Schemas: `packages/shared/src/auth/` (roll, phone, password rules, request/response schemas)
- Tests: `apps/api/test/auth.e2e-spec.ts`, `apps/api/src/modules/auth/*.spec.ts`, `apps/web/e2e/auth.spec.ts`
- Seed: none yet (demo accounts come with the `users` module)

## Known limitations / future work

- **SMS codes** are not built; `channel` is always `email`. The `SmsProvider` interface comes when SMS is needed.
- **Forgot password / change password** are not built yet. When they are, all sessions must be revoked.
- **Email ownership** is proven at the first login (the code goes to that address), not at sign-up.
- **Behind a reverse proxy**, configure Express `trust proxy` so rate limits see the real client IP.
- The common-password list is short (~100 entries) on purpose; a larger list could be added later.
- RUET roll is checked only as 7 digits; department codes are not validated.
