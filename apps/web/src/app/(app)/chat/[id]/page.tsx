import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ChatThread, chatHelp } from '@/features/chat';

export const metadata: Metadata = { title: chatHelp.thread.title };

export default function ChatThreadPage({ params }: PageProps<'/chat/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <ChatThread conversationId={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="chat" steps={chatHelp.intro} />
    </>
  );
}
