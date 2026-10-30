import type { Conversation } from '@ruet-chottor/shared';
import { help } from './help';

/** Group name, or the other person's name in a 1:1 chat. */
export function conversationTitle(conversation: Conversation, myId: string): string {
  if (conversation.type === 'group') return conversation.name ?? help.page.title;
  const other = conversation.members.find((member) => member.id !== myId);
  return other?.name ?? help.messages.unknownSender;
}
