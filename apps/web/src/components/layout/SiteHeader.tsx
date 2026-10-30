'use client';

import Link from 'next/link';
import { AccountMenu } from '@/features/auth';
import { enabledNavModules } from '@/lib/modules';
import { useFeatures } from '@/lib/use-features';
import { NavLink } from './NavLink';

export function SiteHeader() {
  const { data } = useFeatures();
  const modules = enabledNavModules(data?.modules ?? []);
  const authEnabled = data?.modules.includes('auth') ?? false;

  return (
    // The orange top bar echoes the gear in the RUET logo.
    <header className="border-t-4 border-b border-t-brand-orange bg-background">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="shrink-0 font-semibold tracking-tight text-primary">
          RUET Chottor
        </Link>
        {modules.length > 0 ? (
          <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto">
            {modules.map((module) => (
              <NavLink
                key={module.key}
                href={module.href}
                className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
              >
                {module.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
        {authEnabled ? (
          <div className="ml-auto">
            <AccountMenu />
          </div>
        ) : null}
      </div>
    </header>
  );
}
