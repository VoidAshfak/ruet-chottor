---
name: add-realtime-feature
description: Add a Socket.IO namespace or event to RUET Chottor (chat, notifications, bus tracking) with authenticated sockets, shared event constants, Zod-validated payloads and persist-then-broadcast delivery. Use for any real-time functionality.
---

# Add a real-time feature

Check current Socket.IO and NestJS WebSocket docs via Context7 before writing gateway code.

## 1. Event contract (`packages/shared/src/socket-events.ts`)

```ts
export const ChatEvents = {
  MessageNew: "chat:message:new",       // server -> client
  MessageSend: "chat:message:send",     // client -> server
  Typing: "chat:typing",
} as const;
```
- Name format: `<module>:<entity>:<action>`. Never use raw strings in app code.
- Define a Zod schema for every payload in `packages/shared/src/<module>/socket-schemas.ts`.

## 2. Server (NestJS gateway in the module folder)

- One namespace per module: `/chat`, `/notifications`, `/bus`.
- Authenticate on connection using the session cookie; disconnect unauthenticated or suspended users.
- Validate every incoming payload with the shared Zod schema; reply with an error ack on failure.
- Check permissions per event (e.g. user is a member of the chat group) — never trust the room name from the client.
- Rooms: `user:<id>` for personal delivery, `group:<id>` for groups. Join rooms server-side only.
- **Persist first, then broadcast.** Save to Postgres in the service, then emit. Return the saved object in the ack.
- Rate-limit sends per user (config value).
- Use the Redis adapter when running more than one api instance.

## 3. Client (`apps/web/src/lib/socket.ts` + module hooks)

- One shared socket client per namespace, created lazily, cookie auth (`withCredentials: true`).
- Module hooks (`useChatSocket`) subscribe/unsubscribe in effects and update TanStack Query caches.
- Optimistic UI: show a pending message, replace it with the acked one, mark failed on error with "Retry".
- On reconnect: refetch missed data over HTTP (`?after=<lastId>`). The socket is not the source of truth.
- Show connection state subtly (e.g. "Reconnecting…").

## 4. Moderation

Messages are user-generated content → follow `add-moderation` (report a message, hide/remove, sanctions block sending).

## 5. Tests

- Gateway: unauthenticated connection rejected; invalid payload rejected; non-member cannot send to a group.
- Message is persisted before broadcast; a second client receives it.
- Client reconnect fetches missed messages.
