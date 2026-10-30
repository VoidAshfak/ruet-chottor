import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { ChatHome, chatHelp } from '@/features/chat';

export const metadata: Metadata = { title: chatHelp.page.title };

export default function ChatPage() {
  return (
    <>
      <PageHeader title={chatHelp.page.title} description={chatHelp.page.description} />
      <ChatHome />
      <FirstVisitGuide moduleKey="chat" steps={chatHelp.intro} />
    </>
  );
}
