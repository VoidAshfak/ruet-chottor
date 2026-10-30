import {
  type AddMembersRequest,
  chatMessagePageSchema,
  chatMessageSchema,
  conversationPageSchema,
  conversationSchema,
  type CreateGroupRequest,
  type SendMessageRequest,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const noContent = z.undefined();

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const chatApi = {
  conversations: (cursor?: string) =>
    apiRequest(`/chat/conversations${query({ cursor })}`, conversationPageSchema),
  conversation: (id: string) => apiRequest(`/chat/conversations/${id}`, conversationSchema),
  startDirect: (userId: string) =>
    apiRequest('/chat/conversations/direct', conversationSchema, {
      method: 'POST',
      body: { userId },
    }),
  createGroup: (body: CreateGroupRequest) =>
    apiRequest('/chat/conversations/group', conversationSchema, { method: 'POST', body }),
  rename: (id: string, name: string) =>
    apiRequest(`/chat/conversations/${id}`, conversationSchema, {
      method: 'PATCH',
      body: { name },
    }),
  addMembers: (id: string, body: AddMembersRequest) =>
    apiRequest(`/chat/conversations/${id}/members`, conversationSchema, { method: 'POST', body }),
  removeMember: (id: string, userId: string) =>
    apiRequest(`/chat/conversations/${id}/members/${userId}`, noContent, { method: 'DELETE' }),
  /** Newest first with `cursor`; oldest first with `after` (catching up after a reconnect). */
  messages: (id: string, params: { cursor?: string; after?: string } = {}) =>
    apiRequest(`/chat/conversations/${id}/messages${query(params)}`, chatMessagePageSchema),
  /** Fallback for when the socket is not connected. */
  send: (id: string, body: SendMessageRequest) =>
    apiRequest(`/chat/conversations/${id}/messages`, chatMessageSchema, { method: 'POST', body }),
  markRead: (id: string) =>
    apiRequest(`/chat/conversations/${id}/read`, noContent, { method: 'POST' }),
  deleteMessage: (messageId: string) =>
    apiRequest(`/chat/messages/${messageId}`, noContent, { method: 'DELETE' }),
};
