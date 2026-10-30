import { formatDateTime, type ModerationLogEntry, type Role } from '@ruet-chottor/shared';
import Link from 'next/link';
import { help } from '../help';

function detailText(entry: ModerationLogEntry): string | null {
  const details = entry.details ?? {};
  if (entry.action === 'suspend_user' && typeof details.days === 'number') {
    return help.logLine.days(details.days);
  }
  if (
    entry.action === 'change_role' &&
    typeof details.from === 'string' &&
    typeof details.to === 'string'
  ) {
    return help.logLine.role(help.roles[details.from as Role], help.roles[details.to as Role]);
  }
  return null;
}

/** One moderation action. `showTarget` adds who it was about (the full log). */
export function LogEntry({
  entry,
  showTarget = false,
}: {
  entry: ModerationLogEntry;
  showTarget?: boolean;
}) {
  const extra = detailText(entry);
  return (
    <li className="rounded-lg border p-3">
      <p className="text-sm">
        <span className="font-medium">{help.actionNames[entry.action]}</span>
        {showTarget ? (
          <>
            {' '}
            {entry.targetUser ? (
              <Link
                href={`/admin/users/${entry.targetUser.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {entry.targetUser.name} ({entry.targetUser.roll})
              </Link>
            ) : (
              help.logLine.unknownPerson
            )}
          </>
        ) : null}
        {extra ? ` ${extra}` : null}{' '}
        <span className="text-muted-foreground">
          {help.logLine.by(entry.moderator?.name ?? help.logLine.unknownPerson)} ·{' '}
          <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
        </span>
      </p>
      <p className="mt-1 text-sm break-words text-muted-foreground">{entry.reason}</p>
    </li>
  );
}
