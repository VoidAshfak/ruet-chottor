'use client';

import type { ChatMessage } from '@ruet-chottor/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/guide/PageHeader';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { conversationTitle } from '../conversation-title';
import { help } from '../help';
import { insertMessage, useConversation, useMarkRead, useMessages } from '../hooks/use-chat';
import { useChatConnection } from './ChatSocketProvider';
import { Composer } from './Composer';
import { ConnectionBanner } from './ConnectionBanner';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { MessageItem } from './MessageItem';

type PendingMessage = { clientId: string; body: string; error?: string };

/** One conversation: history, live messages, typing hints and the composer. */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const session = useSession();
  const myId = session.user?.id;
  const queryClient = useQueryClient();
  const connection = useChatConnection();
  const conversation = useConversation(conversationId, { enabled: !!myId });
  const messages = useMessages(conversationId, { enabled: conversation.isSuccess });
  const markRead = useMarkRead(conversationId);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Pages are newest first; show oldest at the top.
  const items = (messages.data?.pages.flatMap((page) => page.items) ?? []).toReversed();
  const newestId = items.at(-1)?.id;
  const reportedIds = useReportedIds(
    'chat.message',
    items.filter((m) => m.sender?.id !== myId && !m.deleted).map((m) => m.id),
  );

  useEffect(() => {
    if (newestId && document.visibilityState === 'visible') markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark read once per newest message
  }, [newestId]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [items.length, pending.length]);

  const send = async (body: string, clientId = crypto.randomUUID()) => {
    stickToBottom.current = true;
    setPending((list) => [...list.filter((p) => p.clientId !== clientId), { clientId, body }]);
    try {
      const message: ChatMessage = await connection.send(conversationId, body, clientId);
      insertMessage(queryClient, message);
      setPending((list) => list.filter((p) => p.clientId !== clientId));
    } catch (error) {
      const message = error instanceof Error ? error.message : help.messages.failed;
      setPending((list) =>
        list.map((p) => (p.clientId === clientId ? { ...p, error: message } : p)),
      );
    }
  };

  if (session.isPending || (myId && conversation.isPending)) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (!myId) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.login}</Link>
        </Button>
      </div>
    );
  }
  if (conversation.isError) {
    const missing =
      conversation.error instanceof ApiError && [400, 404].includes(conversation.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : conversation.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/chat">{help.back}</Link>
        </Button>
      </div>
    );
  }

  const chat = conversation.data!;
  const typingNames = connection.typingIn(conversationId);

  return (
    <>
      <Link href="/chat" className="mb-2 inline-block text-sm text-primary hover:underline">
        ← {help.back}
      </Link>
      <PageHeader
        title={conversationTitle(chat, myId)}
        description={
          chat.type === 'group'
            ? help.list.groupLabel(chat.members.length)
            : help.thread.description
        }
        actions={
          chat.type === 'group' ? (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              {help.group.manage.button}
            </Button>
          ) : undefined
        }
      />
      <ConnectionBanner state={connection.state} />

      <div
        ref={scroller}
        className="h-[60vh] overflow-y-auto rounded-lg border p-3"
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {messages.hasNextPage ? (
          <div className="mb-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={messages.isFetchingNextPage}
              onClick={() => {
                stickToBottom.current = false;
                void messages.fetchNextPage();
              }}
            >
              {messages.isFetchingNextPage ? help.messages.loadingOlder : help.messages.older}
            </Button>
          </div>
        ) : null}

        {messages.isPending ? (
          <p className="text-center text-sm text-muted-foreground">{help.messages.loading}</p>
        ) : messages.isError ? (
          <div role="alert" className="text-center">
            <p className="text-destructive">{messages.error.message}</p>
            <Button variant="outline" className="mt-2" onClick={() => void messages.refetch()}>
              {help.list.retry}
            </Button>
          </div>
        ) : items.length === 0 && pending.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{help.messages.empty}</p>
        ) : null}

        <ul className="grid gap-3" aria-live="polite" aria-label={help.page.title}>
          {items.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              mine={message.sender?.id === myId}
              reported={reportedIds.has(message.id)}
              showSender={
                chat.type === 'group' &&
                message.sender?.id !== myId &&
                items[index - 1]?.sender?.id !== message.sender?.id
              }
            />
          ))}
          {pending.map((message) => (
            <li key={message.clientId} className="flex flex-col items-end">
              <div className="max-w-[85%] rounded-2xl bg-primary/70 px-3 py-2 break-words whitespace-pre-wrap text-primary-foreground">
                {message.body}
              </div>
              {message.error ? (
                <p
                  role="alert"
                  className="mt-0.5 flex items-center gap-1 px-1 text-xs text-destructive"
                >
                  {help.messages.failed} {message.error}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void send(message.body, message.clientId)}
                  >
                    {help.messages.retry}
                  </Button>
                </p>
              ) : (
                <span className="mt-0.5 px-1 text-xs text-muted-foreground">
                  {help.messages.sending}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-1 h-5 text-sm text-muted-foreground" aria-live="polite">
        {typingNames.length > 0 ? help.messages.typing(typingNames) : ''}
      </p>
      <Composer
        onSend={(body) => void send(body)}
        onTyping={() => connection.sendTyping(conversationId)}
      />

      {settingsOpen && chat.type === 'group' ? (
        <GroupSettingsDialog
          conversation={chat}
          myId={myId}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}
