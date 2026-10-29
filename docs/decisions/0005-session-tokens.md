# 0005 — Opaque session tokens instead of JWTs

**Status:** Accepted · 2026-10-29

## Context

CLAUDE.md §6 asks for a short-lived access token and a rotating refresh token in `httpOnly` cookies.
A common way to do this is a signed JWT access token. We also need to log users out instantly, block suspended
users, and keep the dependency list small.

## Decision

Both tokens are **random 256-bit strings** with no meaning of their own.

- **Access token** (15 min): stored in Redis as `auth:access:<sha256>` → `{ userId, sessionId, role }`.
  The global `AuthGuard` looks it up on every request (one Redis `GET`).
- **Refresh token** (30 days): only its SHA-256 hash is stored, in the `Session` row for that device.
  Each refresh replaces it (rotation). The previous hash is kept; if that old token is presented again more than
  30 seconds later, someone else has a copy, so the session is revoked.
- Logout deletes the access token from Redis and revokes the session row.

## Alternatives considered

- **JWT access token** (`@nestjs/jwt` or `jose`): no Redis lookup, but a new dependency, and a stolen or
  logged-out token stays valid until it expires unless we add a deny-list, which is a Redis lookup anyway.
- **Single long-lived session cookie**: simpler, but does not meet the short-lived + rotating requirement.

## Consequences

- Redis is required for every authenticated request: without it, logged-in requests fail.
- No new dependency; tokens are created with `node:crypto`.
- A database or Redis dump does not contain usable tokens (only hashes).
- A role change applies at the next refresh (at most 15 minutes).
