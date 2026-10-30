/**
 * Socket.IO namespaces and event names, grouped per module, format `<module>:<entity>:<action>`.
 * App code must use these constants, never string literals (CLAUDE.md §10).
 * Payload schemas live next to each module's schemas, e.g. `chat/socket-schemas.ts`.
 */

export const SOCKET_NAMESPACES = {
  chat: '/chat',
  notifications: '/notifications',
} as const;

export const ChatEvents = {
  /** client -> server, acknowledged with `ChatSendAck`. */
  MessageSend: 'chat:message:send',
  /** server -> client */
  MessageNew: 'chat:message:new',
  MessageDeleted: 'chat:message:deleted',
  /** A moderator hid, removed or restored a message: refetch the thread. */
  MessageModerated: 'chat:message:moderated',
  ConversationUpdated: 'chat:conversation:updated',
  /** client -> server: "I am typing" */
  TypingStart: 'chat:typing:start',
  /** server -> client: someone else in the conversation is typing */
  TypingUpdate: 'chat:typing:update',
} as const;

export const NotificationEvents = {
  /** server -> client: a new notification was saved for you. */
  New: 'notifications:notification:new',
  /** server -> client: read state changed in another tab or device; refetch the count. */
  ReadChanged: 'notifications:read:changed',
} as const;
