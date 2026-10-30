'use client';

import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useModerationLog, useStaff } from '../hooks/use-admin';
import { LogEntry } from './LogEntry';

/** The whole moderation log, newest first. Staff only (wrap in StaffOnly). */
export function ModerationLogView() {
  const { isStaff } = useStaff();
  const log = useModerationLog({ enabled: isStaff });
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];

  if (log.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {help.states.loading}
      </p>
    );
  }
  if (log.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{log.error.message}</p>
        <Button variant="outline" className="mt-4" onClick={() => void log.refetch()}>
          {help.states.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {help.tabs.log}
        <InfoTip text={help.tips.log} label={`About ${help.tabs.log.toLowerCase()}`} />
      </div>
      {entries.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">{help.log.empty}</p>
      ) : (
        <ul className="grid gap-2">
          {entries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} showTarget />
          ))}
        </ul>
      )}
      {log.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={log.isFetchingNextPage}
            onClick={() => void log.fetchNextPage()}
          >
            {log.isFetchingNextPage ? help.states.loading : help.states.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
