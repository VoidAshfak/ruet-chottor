# Chat

Real-time messaging: one-to-one chats and groups of up to 50 members. Messages are saved in PostgreSQL first and
then pushed to everyone in the conversation over Socket.IO; the socket is only a delivery channel
([ADR 0008](../decisions/0008-realtime-socket-io.md)).

**Status:** Done (Phase 2): 1:1 and group chat, live delivery, typing hints, unread counts, message reports.
**Feature flag:** `FEATURE_CHAT` (needs `FEATURE_AUTH`; the group member picker also needs `FEATURE_DIRECTORY`)

## User flows

- A member presses **Message** on someone's profile or directory card. The 1:1 chat between the two opens
  (created the first time; there is only ever one per pair).
- A member presses **New group**, names it, and picks members by searching the directory. The creator is the owner.
- Messages appear instantly for everyone in the chat. While the other person types, "Nusrat is typing…" shows.
- The conversation list shows the latest message and an unread count, which clears when the chat is opened.
- The sender can delete their own message; everyone then sees "Message deleted".
- The group owner renames the group and adds or removes members. Anyone can leave; an owner who leaves hands the
  group to the longest-standing member.
- People added to a group see only messages sent after they joined.
- When the connection drops, "Reconnecting…" shows. Messages typed meanwhile are sent over HTTP, and missed ones
  are fetched once the socket is back.

## Roles & permissions

Chat works the same for every role. Rules are per conversation, checked on the server for every request and
socket event:

| Action | Any member of the chat | Group owner | Not a member |
|---|---|---|---|
| Read messages, send, mark as read | ✅ | ✅ | ❌ (404) |
| Delete a message | own only | own only | ❌ |
| Rename group, add or remove members | ❌ | ✅ | ❌ |
| Leave a group | ✅ | ✅ | — |

Suspended and banned members cannot start chats or send messages, even with a still-valid access token.

## Data model

See the `// ===== chat =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Conversation**: `type` (`direct | group`), `name` (groups), `createdById`, `directKey` (unique
  `"<id>:<id>"` for 1:1 chats), `lastMessageAt` (sorts the list).
- **ConversationMember**: `role` (`owner | member`), `joinedAt` (history starts here), `lastReadAt` (unread count),
  `leftAt` (left or removed).
- **Message**: `senderId`, `body` (1–2000 characters), `status` (`visible | hidden | removed`, for moderators),
  `deletedAt` (deleted by the sender). The text of a deleted message is kept so moderators can still review a
  report, but it is never sent to members again. Hidden and removed messages are not served at all.

## API

All paths start with `/api/v1/chat`. Every route needs a login. Errors use `{ error: { code, message } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/conversations?cursor=&limit=` | Your conversations, newest activity first, with last message and unread count |
| POST | `/conversations/direct` | `{ userId }` → the 1:1 chat (created if needed). `404` for inactive members |
| POST | `/conversations/group` | `{ name, memberIds }` (1–49 others) → the new group |
| GET | `/conversations/:id` | One conversation |
| PATCH | `/conversations/:id` | `{ name }`, owner only |
| POST | `/conversations/:id/members` | `{ userIds }`, owner only |
| DELETE | `/conversations/:id/members/:userId` | Owner removes someone, or you remove yourself (leave) → `204` |
| GET | `/conversations/:id/messages?cursor=&limit=` | History, newest first |
| GET | `/conversations/:id/messages?after=<messageId>` | Messages after that one, oldest first (catching up) |
| POST | `/conversations/:id/messages` | `{ body, clientId? }` → the saved message. Fallback when the socket is down |
| POST | `/conversations/:id/read` | Mark everything as read → `204` |
| DELETE | `/messages/:id` | Delete your own message → `204` |

Non-members get `404`, so they cannot tell whether a conversation exists.

## Real-time

Namespace `/chat`. Event names are constants in
[`socket-events.ts`](../../packages/shared/src/socket-events.ts); payload schemas are in
`packages/shared/src/chat/socket-schemas.ts`.

| Event | Direction | Payload |
|---|---|---|
| `chat:message:send` | client → server, acknowledged | `{ conversationId, body, clientId? }` → `{ ok: true, message }` or `{ ok: false, error }` |
| `chat:message:new` | server → client | `{ message }` |
| `chat:message:deleted` | server → client | `{ conversationId, messageId }` |
| `chat:message:moderated` | server → client | `{ conversationId, messageId }` (a moderator acted: refetch the thread) |
| `chat:conversation:updated` | server → client | `{ conversationId }` (refetch it: name, members, or you were removed) |
| `chat:typing:start` | client → server | `{ conversationId }` |
| `chat:typing:update` | server → client | `{ conversationId, userId, name }` |

- The handshake is authenticated with the `rc_access` cookie and must come from `WEB_ORIGIN`.
- Each socket joins only its own `user:<id>` room; the server sends every event to each member's room. Clients
  never name a room.
- Each event re-checks the session, and open sockets re-check it every minute, so logout, expiry and suspension
  close them. The browser then refreshes the session and reconnects.

## Moderation

Members can **Report** other people's messages (see [moderation.md](moderation.md)); only people in the conversation
who could see the message may report it. `chat-moderation.ts` registers `chat.message` with the moderation registry.
A hidden or removed message is no longer served to anyone except its sender, who sees `moderated: true` without the
text ("Hidden by a moderator"); open chats refresh on `chat:message:moderated`. Sending is rate-limited:
`CHAT_SEND_LIMIT_PER_MINUTE` messages per member (default 30), 10 new groups and 30 new 1:1 chats per hour.
Suspended members cannot send.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_CHAT` | off | Registers `/chat` routes and the `/chat` socket namespace, shows **Messages** |
| `CHAT_SEND_LIMIT_PER_MINUTE` | `30` | Messages one member may send per minute |

## Code map

- Backend: `apps/api/src/modules/chat/` (`ChatService` rules, `ChatController`, `ChatGateway`, `ChatRealtime`)
- Socket plumbing: `apps/api/src/core/realtime/` (cookie login for sockets, Socket.IO adapter with origin check)
- Frontend: `apps/web/src/features/chat/` (`ChatHome`, `ChatThread`, `GroupSettingsDialog`, `StartChatButton`,
  `ChatSocketProvider` + `use-chat-socket.ts`)
- Socket client: `apps/web/src/lib/socket.ts`
- Pages: `apps/web/src/app/(app)/chat` (layout holds the socket), `chat/[id]`
- Schemas: `packages/shared/src/chat/`
- Seed: `apps/api/prisma/seed/chat.ts` (a 1:1 chat with an unread message and a group, for the Demo Student)
- Tests: `apps/api/src/modules/chat/chat.service.spec.ts`, `apps/api/test/chat.e2e-spec.ts` (HTTP and real sockets),
  `apps/web/e2e/chat.spec.ts`

## Known limitations / future work

- Text only: attachments need the file-storage service first. No editing, reactions or per-person read receipts.
- One API instance only: running several needs the Socket.IO Redis adapter.
- No blocking yet: any active member can message any other. Rate limits slow down spam meanwhile.
- A message sent over the socket whose acknowledgement times out is retried over HTTP and could, rarely, be saved
  twice.
