import { z } from 'zod';
import { ROLES } from '../auth/schemas.js';
import { cursorPageQuerySchema, cursorPageSchema } from '../common/pagination.js';

export const CONVERSATION_TYPES = ['direct', 'group'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CONVERSATION_ROLES = ['owner', 'member'] as const;
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export const CHAT_LIMITS = {
  messageMaxLength: 2000,
  groupNameMaxLength: 60,
  /** Including the creator. */
  groupMaxMembers: 50,
  /** Unread counts above this show as "99+". */
  unreadDisplayMax: 99,
  /** A typing indicator disappears this long after the last keystroke event. */
  typingTimeoutMs: 4000,
} as const;

const id = z.uuid();

export const chatPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
});
export type ChatPerson = z.infer<typeof chatPersonSchema>;

export const chatMemberSchema = chatPersonSchema.extend({
  conversationRole: z.enum(CONVERSATION_ROLES),
});
export type ChatMember = z.infer<typeof chatMemberSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  /** null if the sender's account no longer exists. */
  sender: chatPersonSchema.nullable(),
  /** null once the message was deleted by its sender or removed by a moderator. */
  body: z.string().nullable(),
  deleted: z.boolean(),
  createdAt: z.string(),
  /** Echoed back to the sender only, so the browser can replace its pending copy. */
  clientId: z.string().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  type: z.enum(CONVERSATION_TYPES),
  /** Group name; null for 1:1 chats (show the other person's name). */
  name: z.string().nullable(),
  /** Current members, the viewer included. */
  members: z.array(chatMemberSchema),
  myRole: z.enum(CONVERSATION_ROLES),
  lastMessage: chatMessageSchema.nullable(),
  lastMessageAt: z.string(),
  unreadCount: z.number().int().min(0),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationPageSchema = cursorPageSchema(conversationSchema);
export type ConversationPage = z.infer<typeof conversationPageSchema>;

export const chatMessagePageSchema = cursorPageSchema(chatMessageSchema);
export type ChatMessagePage = z.infer<typeof chatMessagePageSchema>;

export const conversationIdParamSchema = z.object({ id });
export const messageIdParamSchema = z.object({ id });
export const memberParamSchema = z.object({ id, userId: id });

export const startDirectChatRequestSchema = z.object({ userId: id }).strict();
export type StartDirectChatRequest = z.infer<typeof startDirectChatRequestSchema>;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the group a name')
  .max(
    CHAT_LIMITS.groupNameMaxLength,
    `Group names are at most ${CHAT_LIMITS.groupNameMaxLength} characters`,
  );

const memberIdsSchema = z
  .array(id)
  .min(1, 'Add at least one member')
  .max(
    CHAT_LIMITS.groupMaxMembers - 1,
    `A group has at most ${CHAT_LIMITS.groupMaxMembers} members`,
  )
  .refine((ids) => new Set(ids).size === ids.length, 'A member is listed twice');

export const createGroupRequestSchema = z
  .object({ name: groupNameSchema, memberIds: memberIdsSchema })
  .strict();
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

export const renameGroupRequestSchema = z.object({ name: groupNameSchema }).strict();
export type RenameGroupRequest = z.infer<typeof renameGroupRequestSchema>;

export const addMembersRequestSchema = z.object({ userIds: memberIdsSchema }).strict();
export type AddMembersRequest = z.infer<typeof addMembersRequestSchema>;

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, 'Write a message first')
  .max(
    CHAT_LIMITS.messageMaxLength,
    `Messages are at most ${CHAT_LIMITS.messageMaxLength} characters`,
  );

export const sendMessageRequestSchema = z
  .object({
    body: messageBodySchema,
    /** Any id the browser picks for its pending copy of the message. */
    clientId: z.string().min(1).max(64).optional(),
  })
  .strict();
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/**
 * `?cursor=` pages backwards through history (newest first).
 * `?after=<messageId>` returns what arrived after that message (oldest first), for catching up
 * after a reconnect.
 */
export const messagesQuerySchema = cursorPageQuerySchema.extend({
  after: id.optional(),
});
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
