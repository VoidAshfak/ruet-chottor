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
  if (
    (entry.action === 'verify_class_rep' || entry.action === 'revoke_class_rep') &&
    typeof details.section === 'string'
  ) {
    return help.logLine.section(details.section);
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
        {entry.contentType && entry.contentId ? (
          <>
            {' '}
            <Link
              href={`/admin/moderation/${entry.contentType}/${entry.contentId}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {help.logLine.content(
                help.logLine.contentLabels[entry.contentType] ?? entry.contentType,
              )}
            </Link>
            {showTarget && entry.targetUser
              ? ` ${help.logLine.contentBy(entry.targetUser.name)}`
              : null}
          </>
        ) : showTarget ? (
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
          {entry.details?.auto === true
            ? help.logLine.automatic
            : help.logLine.by(entry.moderator?.name ?? help.logLine.unknownPerson)}{' '}
          · <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
        </span>
      </p>
      <p className="mt-1 text-sm break-words text-muted-foreground">{entry.reason}</p>
    </li>
  );
}
