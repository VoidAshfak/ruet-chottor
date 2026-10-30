'use client';

import {
  CHAT_LIMITS,
  ChatEvents,
  type ChatMessage,
  chatConversationUpdatedEventSchema,
  chatMessageDeletedEventSchema,
  chatMessageModeratedEventSchema,
  chatMessageNewEventSchema,
  chatSendAckSchema,
  chatTypingEventSchema,
  SOCKET_NAMESPACES,
} from '@ruet-chottor/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { chatApi } from '../api';
import { cachedThreads, chatKeys, insertMessage, markMessageDeleted } from './use-chat';

const ACK_TIMEOUT_MS = 10_000;

export type ConnectionState = 'connecting' | 'connected' | 'offline';
type Typing = Record<string, Record<string, { name: string; until: number }>>;

export type ChatConnection = ReturnType<typeof useChatSocket>;

/** Sockets that connected at least once: a later disconnect means "offline", not "connecting". */
const everConnected = new WeakSet<object>();

function subscribeToConnection(onChange: () => void) {
  const socket = getSocket(SOCKET_NAMESPACES.chat);
  const events = ['connect', 'disconnect', 'connect_error'] as const;
  for (const event of events) socket.on(event, onChange);
  return () => {
    for (const event of events) socket.off(event, onChange);
  };
}

function connectionSnapshot(): ConnectionState {
  const socket = getSocket(SOCKET_NAMESPACES.chat);
  if (socket.connected) return 'connected';
  return everConnected.has(socket) ? 'offline' : 'connecting';
}

/**
 * Connects to `/chat` while a member is logged in and inside the Messages section (it is used
 * once, by ChatSocketProvider in the chat layout), and keeps the TanStack Query caches in sync
 * with live events. Postgres stays the source of truth: after a reconnect, missed messages are
 * fetched over HTTP (CLAUDE.md §10).
 */
export function useChatSocket({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  // The server render (and the first client render) always say "connecting" (CLAUDE.md §11).
  const state = useSyncExternalStore(
    subscribeToConnection,
    connectionSnapshot,
    () => 'connecting' as const,
  );
  const [typing, setTyping] = useState<Typing>({});

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket(SOCKET_NAMESPACES.chat);
    let wasConnected = socket.connected;
    const refreshList = () =>
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });

    const catchUp = async () => {
      for (const thread of cachedThreads(queryClient)) {
        let after = thread.newest;
        if (!after) continue;
        try {
          for (;;) {
            const page = await chatApi.messages(thread.id, { after });
            for (const message of page.items) insertMessage(queryClient, message);
            if (!page.nextCursor) break;
            after = page.nextCursor;
          }
        } catch {
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(thread.id) });
        }
      }
      refreshList();
    };

    const onConnect = () => {
      everConnected.add(socket);
      if (wasConnected) void catchUp();
      wasConnected = true;
    };
    const onMessage = (payload: unknown) => {
      const parsed = chatMessageNewEventSchema.safeParse(payload);
      if (!parsed.success) return;
      insertMessage(queryClient, parsed.data.message);
      refreshList();
    };
    const onDeleted = (payload: unknown) => {
      const parsed = chatMessageDeletedEventSchema.safeParse(payload);
      if (!parsed.success) return;
      markMessageDeleted(queryClient, parsed.data.conversationId, parsed.data.messageId);
      refreshList();
    };
    // Hidden messages vanish for others and change for their sender: reload that thread.
    const onModerated = (payload: unknown) => {
      const parsed = chatMessageModeratedEventSchema.safeParse(payload);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        queryKey: chatKeys.messages(parsed.data.conversationId),
      });
      refreshList();
    };
    const onUpdated = (payload: unknown) => {
      const parsed = chatConversationUpdatedEventSchema.safeParse(payload);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(parsed.data.conversationId),
      });
      refreshList();
    };
    const onTyping = (payload: unknown) => {
      const parsed = chatTypingEventSchema.safeParse(payload);
      if (!parsed.success) return;
      const { conversationId, userId, name } = parsed.data;
      setTyping((current) => ({
        ...current,
        [conversationId]: {
          ...current[conversationId],
          [userId]: { name, until: Date.now() + CHAT_LIMITS.typingTimeoutMs },
        },
      }));
    };

    socket.on('connect', onConnect);
    socket.on(ChatEvents.MessageNew, onMessage);
    socket.on(ChatEvents.MessageDeleted, onDeleted);
    socket.on(ChatEvents.MessageModerated, onModerated);
    socket.on(ChatEvents.ConversationUpdated, onUpdated);
    socket.on(ChatEvents.TypingUpdate, onTyping);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ChatEvents.MessageNew, onMessage);
      socket.off(ChatEvents.MessageDeleted, onDeleted);
      socket.off(ChatEvents.MessageModerated, onModerated);
      socket.off(ChatEvents.ConversationUpdated, onUpdated);
      socket.off(ChatEvents.TypingUpdate, onTyping);
      // Leaving the Messages section (or logging out) closes the connection.
      socket.disconnect();
    };
  }, [enabled, queryClient]);

  // Drop typing hints that have run out.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((current) => {
        const next: Typing = {};
        let changed = false;
        for (const [conversationId, people] of Object.entries(current)) {
          const alive = Object.entries(people).filter(([, entry]) => entry.until > now);
          if (alive.length !== Object.keys(people).length) changed = true;
          if (alive.length > 0) next[conversationId] = Object.fromEntries(alive);
        }
        return changed ? next : current;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /** Over the socket when connected, otherwise (or if the session needs a refresh) over HTTP. */
  const send = useCallback(
    async (conversationId: string, body: string, clientId: string): Promise<ChatMessage> => {
      const socket = getSocket(SOCKET_NAMESPACES.chat);
      if (socket.connected) {
        try {
          const ack = chatSendAckSchema.parse(
            await socket
              .timeout(ACK_TIMEOUT_MS)
              .emitWithAck(ChatEvents.MessageSend, { conversationId, body, clientId }),
          );
          if (ack.ok) return ack.message;
          if (ack.error.code !== 'SESSION_EXPIRED') {
            throw new ApiError(400, ack.error.code, ack.error.message);
          }
        } catch (error) {
          if (error instanceof ApiError) throw error;
          // Timed out: fall through to HTTP.
        }
      }
      return chatApi.send(conversationId, { body, clientId });
    },
    [],
  );

  const sendTyping = useCallback((conversationId: string) => {
    const socket = getSocket(SOCKET_NAMESPACES.chat);
    if (socket.connected) socket.emit(ChatEvents.TypingStart, { conversationId });
  }, []);

  const typingIn = (conversationId: string) =>
    Object.values(typing[conversationId] ?? {}).map((entry) => entry.name);

  return { state, send, sendTyping, typingIn };
}
