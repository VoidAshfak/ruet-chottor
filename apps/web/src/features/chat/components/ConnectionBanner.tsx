'use client';

import { InfoTip } from '@/components/guide/InfoTip';
import { help } from '../help';
import type { ConnectionState } from '../hooks/use-chat-socket';

/** A quiet note while the live connection is down (CLAUDE.md §10: show connection state subtly). */
export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state !== 'offline') return null;
  return (
    <p
      role="status"
      className="mb-3 flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
    >
      {help.connection.reconnecting}
      <InfoTip text={help.tips.connection} label={help.connection.tipLabel} />
    </p>
  );
}
