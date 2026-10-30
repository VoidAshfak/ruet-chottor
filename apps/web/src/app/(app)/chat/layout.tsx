import { ChatSocketProvider } from '@/features/chat';

/** One live connection for the whole Messages section; it closes when you leave it. */
export default function ChatLayout({ children }: LayoutProps<'/chat'>) {
  return <ChatSocketProvider>{children}</ChatSocketProvider>;
}
