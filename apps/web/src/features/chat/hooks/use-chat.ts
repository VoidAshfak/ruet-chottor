'use client';

import type { ChatMessage, ChatMessagePage, CreateGroupRequest } from '@ruet-chottor/shared';
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { chatApi } from '../api';

export const chatKeys = {
  all: ['chat'] as const,
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
};

type MessagesData = InfiniteData<ChatMessagePage, string | undefined>;

/** Adds a message to a cached thread (newest first), once, whichever of socket or ack is first. */
export function insertMessage(queryClient: QueryClient, message: ChatMessage) {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    if (data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
    // The clientId only matters to the tab that sent it.
    const stored = { ...message };
    delete stored.clientId;
    const [first, ...rest] = data.pages;
    return {
      ...data,
      pages: [{ ...first!, items: [stored, ...first!.items] }, ...rest],
    };
  });
}

export function markMessageDeleted(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
) {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === messageId ? { ...item, deleted: true, body: null } : item,
            ),
          })),
        }
      : data,
  );
}

/** The newest message id of each cached thread, for catching up after a reconnect. */
export function cachedThreads(queryClient: QueryClient): { id: string; newest?: string }[] {
  return queryClient
    .getQueriesData<MessagesData>({ queryKey: ['chat', 'messages'] })
    .map(([key, data]) => ({ id: String(key[2]), newest: data?.pages[0]?.items[0]?.id }));
}

export function useConversations({ enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: chatKeys.conversations,
    queryFn: ({ pageParam }) => chatApi.conversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export function useConversation(id: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: () => chatApi.conversation(id),
    enabled,
    retry: false,
  });
}

export function useMessages(id: string, { enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ pageParam }) => chatApi.messages(id, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
    // Live events keep the thread current; a refetch would only reload every page.
    staleTime: Infinity,
    retry: false,
  });
}

export function useStartDirect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.startDirect,
    onSuccess: (conversation) => {
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupRequest) => chatApi.createGroup(body),
    onSuccess: (conversation) => {
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}

/** Rename, add or remove members, leave. Each refreshes the conversation afterwards. */
export function useGroupActions(id: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.conversation(id) });
    void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
  };
  return {
    rename: useMutation({
      mutationFn: (name: string) => chatApi.rename(id, name),
      onSuccess: refresh,
    }),
    add: useMutation({
      mutationFn: (userIds: string[]) => chatApi.addMembers(id, { userIds }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => chatApi.removeMember(id, userId),
      onSuccess: refresh,
    }),
  };
}

export function useMarkRead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.conversations }),
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(messageId),
    onSuccess: (_result, messageId) => {
      markMessageDeleted(queryClient, conversationId, messageId);
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}
