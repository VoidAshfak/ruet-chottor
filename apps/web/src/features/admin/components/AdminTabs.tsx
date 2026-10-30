'use client';

import type { ModuleKey } from '@ruet-chottor/shared';
import { NavLink } from '@/components/layout/NavLink';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';

type Tab = {
  href: string;
  label: string;
  isActive?: (pathname: string) => boolean;
  /** Shown only when this module is switched on. */
  needs?: ModuleKey;
};

const TABS: Tab[] = [
  {
    href: '/admin',
    label: help.tabs.members,
    isActive: (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/users'),
  },
  { href: '/admin/moderation', label: help.tabs.reports, needs: 'moderation' },
  { href: '/admin/news', label: help.tabs.news, needs: 'news' },
  { href: '/admin/clubs', label: help.tabs.clubs, needs: 'clubs' },
  { href: '/admin/log', label: help.tabs.log },
];

export function AdminTabs() {
  const modules = useFeatures().data?.modules ?? [];
  return (
    <nav aria-label={help.nav} className="mb-6 flex gap-1 border-b">
      {TABS.filter((tab) => !tab.needs || modules.includes(tab.needs)).map((tab) => (
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
