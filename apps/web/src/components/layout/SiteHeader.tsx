'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdminNavLink } from '@/features/admin';
import { AccountMenu } from '@/features/auth';
import { enabledNavModules } from '@/lib/modules';
import { useFeatures } from '@/lib/use-features';
import { help } from './help';
import { NAV_LINK_CLASS, NavLink } from './NavLink';

/**
 * Wide screens show the sections inline; narrower ones get a Menu button, so the bar never
 * scrolls or wraps however many sections are on.
 */
export function SiteHeader() {
  const { data } = useFeatures();
  const modules = enabledNavModules(data?.modules ?? []);
  const authEnabled = data?.modules.includes('auth') ?? false;
  const adminEnabled = authEnabled && (data?.modules.includes('admin') ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    // The orange top bar echoes the gear in the RUET logo.
    <header className="border-t-4 border-b border-t-brand-orange bg-background">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          aria-label={help.home}
          className="shrink-0 font-semibold tracking-tight text-primary"
        >
          RUET Chottor
        </Link>

        {modules.length > 0 || adminEnabled ? (
          <nav aria-label={help.mainNav} className="hidden min-w-0 items-center gap-0.5 lg:flex">
            {modules.map((module) => (
              <NavLink key={module.key} href={module.href} className={NAV_LINK_CLASS}>
                {module.label}
              </NavLink>
            ))}
            {adminEnabled ? <AdminNavLink /> : null}
          </nav>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {modules.length > 0 || adminEnabled ? (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden" aria-label={help.menuLabel}>
                  <MenuIcon aria-hidden />
                  {help.menu}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <nav aria-label={help.sections} className="grid gap-0.5">
                  {modules.map((module) => (
                    <NavLink
                      key={module.key}
                      href={module.href}
                      className={`${NAV_LINK_CLASS} block py-2`}
                      onClick={close}
                    >
                      {module.label}
                    </NavLink>
                  ))}
                  {adminEnabled ? (
                    <AdminNavLink className={`${NAV_LINK_CLASS} block py-2`} onNavigate={close} />
                  ) : null}
                </nav>
              </PopoverContent>
            </Popover>
          ) : null}
          {authEnabled ? <AccountMenu /> : null}
        </div>
      </div>
    </header>
  );
}
