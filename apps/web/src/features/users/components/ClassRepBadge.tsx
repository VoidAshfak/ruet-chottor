import type { ClassRepBadge as Badge } from '@ruet-chottor/shared';
import { BadgeCheckIcon } from 'lucide-react';
import { help } from '../help';

/** The "verified CR" pill on profiles and directory cards. */
export function ClassRepBadge({ badge }: { badge: Badge }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
      <BadgeCheckIcon aria-hidden className="size-3.5" />
      <span aria-hidden>{help.classRep.badge(badge.section)}</span>
      <span className="sr-only">{help.classRep.badgeLabel(badge.section)}</span>
    </span>
  );
}
