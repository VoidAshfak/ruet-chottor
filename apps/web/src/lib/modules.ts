import type { ModuleKey } from '@ruet-chottor/shared';

export type NavModule = {
  key: ModuleKey;
  label: string;
  href: string;
  /** One line shown on the home page. */
  summary: string;
};

/** User-facing sections, in navigation order. auth/users/moderation/admin are not nav items. */
export const NAV_MODULES: NavModule[] = [
  {
    key: 'directory',
    label: 'Directory',
    href: '/directory',
    summary: 'Find students, alumni and teachers.',
  },
  { key: 'chat', label: 'Messages', href: '/chat', summary: 'Chat one-to-one or in groups.' },
  { key: 'news', label: 'News', href: '/news', summary: 'Campus news and announcements.' },
  { key: 'clubs', label: 'Clubs', href: '/clubs', summary: 'Discover clubs and what they do.' },
  { key: 'events', label: 'Events', href: '/events', summary: 'Upcoming events on campus.' },
  {
    key: 'lost-found',
    label: 'Lost & Found',
    href: '/lost-found',
    summary: 'Report lost items and return found ones.',
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    href: '/marketplace',
    summary: 'Buy and sell used items within RUET.',
  },
  { key: 'bus', label: 'Bus', href: '/bus', summary: 'Bus routes and schedules.' },
];

export function enabledNavModules(enabled: readonly ModuleKey[]): NavModule[] {
  return NAV_MODULES.filter((module) => enabled.includes(module.key));
}
