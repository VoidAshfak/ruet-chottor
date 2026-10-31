import type { ModuleKey } from '@ruet-chottor/shared';
import {
  BusFrontIcon,
  type LucideIcon,
  MessageCirclePlusIcon,
  PackageSearchIcon,
  TagIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { help } from '../help';

const ACTIONS: { module: ModuleKey; href: string; label: string; icon: LucideIcon }[] = [
  { module: 'chat', href: '/chat', label: help.quickActions.chat, icon: MessageCirclePlusIcon },
  {
    module: 'lost-found',
    href: '/lost-found/new',
    label: help.quickActions.lost,
    icon: PackageSearchIcon,
  },
  { module: 'marketplace', href: '/marketplace/new', label: help.quickActions.sell, icon: TagIcon },
  { module: 'bus', href: '/bus', label: help.quickActions.bus, icon: BusFrontIcon },
];

/** Shortcuts to the most common things members do, for the sections that are on. */
export function QuickActions({ enabled }: { enabled: readonly ModuleKey[] }) {
  const actions = ACTIONS.filter((action) => enabled.includes(action.module));
  if (actions.length === 0) return null;

  return (
    <nav aria-label={help.quickActions.title}>
      <ul className="flex flex-wrap gap-2">
        {actions.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={href} className="no-underline">
                <Icon aria-hidden />
                {label}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
