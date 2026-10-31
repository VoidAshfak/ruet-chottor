import type { ModuleKey } from '@ruet-chottor/shared';
import {
  ArrowRightIcon,
  BusFrontIcon,
  CalendarDaysIcon,
  type LucideIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  SearchCheckIcon,
  ShoppingBagIcon,
  TentIcon,
  UsersRoundIcon,
} from 'lucide-react';
import Link from 'next/link';
import { enabledNavModules } from '@/lib/modules';
import { help } from '../help';

const ICONS: Partial<Record<ModuleKey, LucideIcon>> = {
  directory: UsersRoundIcon,
  chat: MessagesSquareIcon,
  news: NewspaperIcon,
  clubs: TentIcon,
  events: CalendarDaysIcon,
  'lost-found': SearchCheckIcon,
  marketplace: ShoppingBagIcon,
  bus: BusFrontIcon,
};

/** A card per section that is switched on: icon, name and what it is for. */
export function SectionGrid({ enabled }: { enabled: readonly ModuleKey[] }) {
  const modules = enabledNavModules(enabled);
  if (modules.length === 0) return null;
  const text = help.sections;

  return (
    <section aria-labelledby="home-sections" className="grid gap-4">
      <div>
        <h2 id="home-sections" className="text-lg font-semibold">
          {text.title}
        </h2>
        <p className="text-sm text-muted-foreground">{text.description}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {modules.map((module) => {
          const Icon = ICONS[module.key] ?? ArrowRightIcon;
          return (
            <li key={module.key}>
              <Link
                href={module.href}
                className="group grid h-full content-start gap-2 rounded-xl border bg-background p-3 no-underline sm:p-4 transition hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="grid size-10 place-items-center rounded-full bg-accent text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="font-medium text-foreground">{module.label}</span>
                <span className="text-sm text-muted-foreground">{module.summary}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
