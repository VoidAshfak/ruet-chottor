'use client';

import { NAV_LINK_CLASS, NavLink } from '@/components/layout/NavLink';
import { help } from '../help';
import { useStaff } from '../hooks/use-admin';

/** Header link, shown only to moderators and admins. */
export function AdminNavLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { isStaff } = useStaff();
  if (!isStaff) return null;
  return (
    <NavLink href="/admin" className={className ?? NAV_LINK_CLASS} onClick={onNavigate}>
      {help.nav}
    </NavLink>
  );
}
