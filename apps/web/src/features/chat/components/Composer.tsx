'use client';

import { CHAT_LIMITS } from '@ruet-chottor/shared';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { help } from '../help';

// Tell others "typing" at most this often while keys are pressed.
const TYPING_EVERY_MS = 2500;

type ComposerProps = {
  onSend: (body: string) => void;
  onTyping: () => void;
};

/** Enter sends, Shift+Enter adds a new line. */
export function Composer({ onSend, onTyping }: ComposerProps) {
  const [body, setBody] = useState('');
  const lastTyping = useRef(0);
  const trimmed = body.trim();

  const submit = () => {
    if (!trimmed || trimmed.length > CHAT_LIMITS.messageMaxLength) return;
    onSend(trimmed);
    setBody('');
  };

  return (
    <form
      className="mt-3 flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid flex-1 gap-0.5">
        <label htmlFor="chat-composer" className="sr-only">
          {help.composer.label}
        </label>
        <textarea
          id="chat-composer"
          rows={2}
          value={body}
          maxLength={CHAT_LIMITS.messageMaxLength}
          placeholder={help.composer.placeholder}
          className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          onChange={(event) => {
            setBody(event.target.value);
            const now = Date.now();
            if (now - lastTyping.current > TYPING_EVERY_MS) {
              lastTyping.current = now;
              onTyping();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        {body.length > CHAT_LIMITS.messageMaxLength * 0.8 ? (
          <span className="text-right text-xs text-muted-foreground">
            {help.composer.counter(body.length)}
          </span>
        ) : null}
      </div>
      <Button type="submit" disabled={!trimmed}>
        {help.composer.send}
      </Button>
    </form>
  );
}
