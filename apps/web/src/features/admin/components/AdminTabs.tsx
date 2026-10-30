'use client';

import { NavLink } from '@/components/layout/NavLink';
import { help } from '../help';

const TABS = [
  {
    href: '/admin',
    label: help.tabs.members,
    isActive: (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/users'),
  },
  { href: '/admin/log', label: help.tabs.log },
];

export function AdminTabs() {
  return (
    <nav aria-label={help.nav} className="mb-6 flex gap-1 border-b">
      {TABS.map((tab) => (
        <NavLink
          key={tab.href}
          href={tab.href}
          isActive={tab.isActive}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
