'use client';

import { type ChatMessage, formatDateTime } from '@ruet-chottor/shared';
import { useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { ReportAction } from '@/features/moderation';
import { help } from '../help';
import { useDeleteMessage } from '../hooks/use-chat';
import { ConfirmDialog } from './ConfirmDialog';

type MessageItemProps = {
  message: ChatMessage;
  mine: boolean;
  /** Show the sender's name (groups, and not for your own messages). */
  showSender: boolean;
  /** The viewer already reported this message. */
  reported: boolean;
};

export function MessageItem({ message, mine, showSender, reported }: MessageItemProps) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteMessage(message.conversationId);
  const text = help.messages;

  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {showSender ? (
        <span className="mb-0.5 px-1 text-xs text-muted-foreground">
          {message.sender?.name ?? text.unknownSender}
        </span>
      ) : null}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 break-words whitespace-pre-wrap ${
          message.deleted || message.moderated
            ? 'border text-muted-foreground italic'
            : mine
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
        }`}
      >
        {message.moderated ? (
          <span className="inline-flex items-center gap-1">
            {text.moderated}
            <InfoTip text={help.tips.moderated} label={text.moderated} />
          </span>
        ) : message.deleted ? (
          <span className="inline-flex items-center gap-1">
            {text.deleted}
            <InfoTip text={help.tips.deleted} label={text.deleted} />
          </span>
        ) : (
          message.body
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1 px-1">
        <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
          {formatDateTime(message.createdAt)}
        </time>
        {!mine && !message.deleted && !message.moderated ? (
          <ReportAction contentType="chat.message" contentId={message.id} reported={reported} />
        ) : null}
        {mine && !message.deleted && !message.moderated ? (
          <Button
            variant="ghost"
            size="xs"
            aria-label={text.deleteLabel}
            onClick={() => setConfirming(true)}
          >
            {text.delete}
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <ConfirmDialog
          {...text.confirmDelete}
          pending={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate(message.id, { onSuccess: () => setConfirming(false) })}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
}
