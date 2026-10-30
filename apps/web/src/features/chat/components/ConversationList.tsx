'use client';

import { type Conversation, formatDateTime } from '@ruet-chottor/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { conversationTitle } from '../conversation-title';
import { help } from '../help';
import { useConversations } from '../hooks/use-chat';

function preview(conversation: Conversation, myId: string): string {
  const last = conversation.lastMessage;
  if (!last) return help.list.noMessages;
  const text = last.deleted ? help.list.deleted : (last.body ?? '');
  if (last.sender?.id === myId) return `${help.list.you}: ${text}`;
  return conversation.type === 'group' && last.sender ? `${last.sender.name}: ${text}` : text;
}

/** The member's conversations, most recent first, with unread counts. */
export function ConversationList({ myId }: { myId: string }) {
  const conversations = useConversations({ enabled: true });
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];

  if (conversations.isPending) {
    return (
      <ul className="grid gap-2" aria-label={help.list.loading}>
        {[0, 1, 2].map((row) => (
          <li key={row} className="h-16 animate-pulse rounded-lg border bg-muted" />
        ))}
      </ul>
    );
  }
  if (conversations.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{conversations.error.message ?? help.list.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void conversations.refetch()}>
          {help.list.retry}
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-muted-foreground">{help.list.empty}</p>
    );
  }

  return (
    <>
      <ul className="grid gap-2">
        {items.map((conversation) => {
          const unread = conversation.unreadCount;
          return (
            <li key={conversation.id}>
              <Link
                href={`/chat/${conversation.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent focus-visible:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                      {conversationTitle(conversation, myId)}
                    </span>
                    {conversation.type === 'group' ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {help.list.groupLabel(conversation.members.length)}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {preview(conversation, myId)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time
                    dateTime={conversation.lastMessageAt}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDateTime(conversation.lastMessageAt)}
                  </time>
                  {unread > 0 ? (
                    <span
                      className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-medium text-primary-foreground"
                      aria-label={help.list.unreadLabel(unread)}
                    >
                      {help.list.unread(unread)}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {conversations.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={conversations.isFetchingNextPage}
            onClick={() => void conversations.fetchNextPage()}
          >
            {help.list.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}
