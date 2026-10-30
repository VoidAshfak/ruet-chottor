'use client';

import { createContext, type ReactNode, use } from 'react';
import { useSession } from '@/features/auth';
import { type ChatConnection, useChatSocket } from '../hooks/use-chat-socket';

const ChatConnectionContext = createContext<ChatConnection | null>(null);

/**
 * Holds the `/chat` socket for the whole Messages section, so moving between the list and a
 * conversation keeps one connection. Rendered by `app/(app)/chat/layout.tsx`.
 */
export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const connection = useChatSocket({ enabled: session.user !== null });
  return <ChatConnectionContext value={connection}>{children}</ChatConnectionContext>;
}

export function useChatConnection(): ChatConnection {
  const connection = use(ChatConnectionContext);
  if (!connection) throw new Error('useChatConnection must be used inside <ChatSocketProvider>');
  return connection;
}
