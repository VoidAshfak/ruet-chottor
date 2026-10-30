'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useChatConnection } from './ChatSocketProvider';
import { ConnectionBanner } from './ConnectionBanner';
import { ConversationList } from './ConversationList';
import { NewGroupDialog } from './NewGroupDialog';

/** /chat: the conversation list and "New group". */
export function ChatHome() {
  const session = useSession();
  const connection = useChatConnection();
  const [creating, setCreating] = useState(false);

  if (session.isPending) {
    return <RuetLoader />;
  }
  if (!session.user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.login}</Link>
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="chat-list-heading">
      <ConnectionBanner state={connection.state} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="chat-list-heading" className="text-sm text-muted-foreground">
          {help.list.heading}
        </h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          {help.list.newGroup}
        </Button>
      </div>
      <ConversationList myId={session.user.id} />
      {creating ? (
        <NewGroupDialog myId={session.user.id} onClose={() => setCreating(false)} />
      ) : null}
    </section>
  );
}
