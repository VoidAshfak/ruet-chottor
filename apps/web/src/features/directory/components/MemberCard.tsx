import type { PublicProfile } from '@ruet-chottor/shared';
import Link from 'next/link';
import { StartChatButton } from '@/features/chat';
import { ClassRepBadge } from '@/features/users';
import { help } from '../help';

/** One search result. The whole name links to the member's profile. */
export function MemberCard({ member }: { member: PublicProfile }) {
  const facts = [
    help.roles[member.role],
    member.department?.short,
    member.series ? String(member.series) : undefined,
    member.roll,
  ].filter(Boolean);
  const contacts = [member.email, member.phone].filter((value): value is string => !!value);

  return (
    <li className="rounded-lg border p-4">
      <Link
        href={`/users/${member.id}`}
        className="font-medium break-words text-primary underline-offset-4 hover:underline"
      >
        {member.name}
      </Link>
      <p className="mt-1 text-sm text-muted-foreground">{facts.join(' · ')}</p>
      {member.classRep ? (
        <div className="mt-2">
          <ClassRepBadge badge={member.classRep} />
        </div>
      ) : null}
      {contacts.length > 0 ? (
        <ul className="mt-2 grid gap-0.5 text-sm">
          {contacts.map((contact) => (
            <li key={contact} className="break-all">
              {contact}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{help.results.contactHidden}</p>
      )}
      <div className="mt-3 flex">
        <StartChatButton userId={member.id} name={member.name} />
      </div>
    </li>
  );
}
