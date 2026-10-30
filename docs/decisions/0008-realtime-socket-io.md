# 0008. Real-time delivery with Socket.IO

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

Chat (Phase 2) is the first real-time module; notifications and the bus tracker will follow. Every one of them needs
the same answers: how a socket logs in, who receives an event, and what happens when the connection drops. CLAUDE.md
§10 already fixes the outline (Socket.IO, one namespace per module, persist first, refetch after reconnect).

## Decision

- **Socket.IO through NestJS gateways** (`@nestjs/websockets`, `@nestjs/platform-socket.io`), one namespace per
  module. The adapter in `core/realtime/socket-io.adapter.ts` only accepts handshakes from `WEB_ORIGIN`, because the
  browser sends the session cookie with them.
- **Same session as HTTP.** The handshake is checked with the `rc_access` cookie (`core/realtime/socket-auth.ts`).
  An expired or missing cookie is rejected with `SESSION_EXPIRED`; the browser refreshes the session over HTTP and
  reconnects (`apps/web/src/lib/socket.ts`). Each event checks the session again, and open sockets check it every
  minute, so logout and suspension also reach open sockets.
- **The global HTTP `AuthGuard` skips socket events.** Gateways authenticate themselves as above. Without this, the
  guard would reject every socket event, because there is no HTTP request to read a cookie from.
- **Personal rooms only.** A socket joins `user:<id>`; services send each event to the rooms of the people who should
  get it, after checking membership in the database. Clients never choose a room, so there is nothing to forge, and
  membership changes take effect immediately without moving sockets between rooms.
- **Persist, then broadcast.** Services save to Postgres and then call a small broadcaster (`ChatRealtime`), so a
  message sent over HTTP (the fallback) reaches sockets exactly like one sent over the socket.
- **The client socket lives in the module's layout** (`ChatSocketProvider`), so it is open only while the member is
  in that section, and it closes on leaving or logging out.

## Consequences

- One API instance for now. Scaling out needs `@socket.io/redis-adapter` (Redis is already in the stack); the room
  scheme does not change.
- Up to a minute (or one event) can pass before a revoked session's socket closes; HTTP has the same 15-minute
  access-token window (ADR 0005).
- Sending to many personal rooms costs one emit per member. Fine for groups of up to 50; very large channels would
  want conversation rooms instead.
