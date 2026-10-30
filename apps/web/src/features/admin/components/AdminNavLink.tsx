'use client';

import { NavLink } from '@/components/layout/NavLink';
import { help } from '../help';
import { useStaff } from '../hooks/use-admin';

/** Header link, shown only to moderators and admins. */
export function AdminNavLink() {
  const { isStaff } = useStaff();
  if (!isStaff) return null;
  return (
    <NavLink
      href="/admin"
      className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
    >
      {help.nav}
    </NavLink>
  );
}
