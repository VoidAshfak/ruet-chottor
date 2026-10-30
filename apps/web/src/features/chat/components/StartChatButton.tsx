'use client';

import { useRouter } from 'next/navigation';
import { FormError } from '@/components/form/FormError';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { useStartDirect } from '../hooks/use-chat';

/**
 * "Message" button for profiles and the directory. Renders nothing when chat is switched off,
 * for visitors, or on your own profile.
 */
export function StartChatButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const features = useFeatures();
  const session = useSession();
  const start = useStartDirect();

  const chatOn = features.data?.modules.includes('chat') ?? false;
  if (!chatOn || !session.user || session.user.id === userId) return null;

  return (
    <div className="grid gap-2">
      <Button
        size="sm"
        variant="outline"
        aria-label={help.startChat.label(name)}
        disabled={start.isPending}
        onClick={() =>
          start.mutate(userId, {
            onSuccess: (conversation) => router.push(`/chat/${conversation.id}`),
          })
        }
      >
        {start.isPending ? help.startChat.starting : help.startChat.button}
      </Button>
      <FormError message={start.error?.message} />
    </div>
  );
}
