import { z } from 'zod';
import { chatMessageSchema, sendMessageRequestSchema } from './schemas.js';

// Payloads of the `/chat` Socket.IO namespace. Event names are in socket-events.ts.

/** client -> server, with an acknowledgement (`ChatSendAck`). */
export const chatSendPayloadSchema = sendMessageRequestSchema.extend({
  conversationId: z.uuid(),
});
export type ChatSendPayload = z.infer<typeof chatSendPayloadSchema>;

export const chatSendAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), message: chatMessageSchema }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) }),
]);
export type ChatSendAck = z.infer<typeof chatSendAckSchema>;

/** client -> server, no acknowledgement. */
export const chatTypingPayloadSchema = z.object({ conversationId: z.uuid() }).strict();
export type ChatTypingPayload = z.infer<typeof chatTypingPayloadSchema>;

/** server -> client */
export const chatMessageNewEventSchema = z.object({ message: chatMessageSchema });
export type ChatMessageNewEvent = z.infer<typeof chatMessageNewEventSchema>;

export const chatMessageDeletedEventSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
});
export type ChatMessageDeletedEvent = z.infer<typeof chatMessageDeletedEventSchema>;

export const chatMessageModeratedEventSchema = chatMessageDeletedEventSchema;

/** Members or name changed, or the viewer was removed: refetch the conversation. */
export const chatConversationUpdatedEventSchema = z.object({ conversationId: z.string() });
export type ChatConversationUpdatedEvent = z.infer<typeof chatConversationUpdatedEventSchema>;

export const chatTypingEventSchema = z.object({
  conversationId: z.string(),
  userId: z.string(),
  name: z.string(),
});
export type ChatTypingEvent = z.infer<typeof chatTypingEventSchema>;
