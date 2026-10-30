'use client';

import { LogOutIcon, UserRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { useLogout, useSession } from '../hooks/use-session';

/** "Rafiq Fakeuddin" -> "RF". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Header corner: log in / sign up for visitors; for members a round initials button whose menu
 * holds the full name, so long names never stretch the header.
 */
export function AccountMenu() {
  const router = useRouter();
  const { user, isPending } = useSession();
  const logout = useLogout();
  const features = useFeatures();
  const profileEnabled = features.data?.modules.includes('users') ?? false;
  const [open, setOpen] = useState(false);

  // Same-size placeholder while loading, so the header does not jump.
  if (isPending) return <div className="size-8" aria-hidden />;

  if (!user) {
    return (
      <div className="flex shrink-0 gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{help.account.login}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/signup">{help.account.signup}</Link>
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={help.account.menuLabel(user.name)}
          title={user.name}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {initials(user.name)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-2 pt-1 pb-2 text-sm">
          <span className="block text-muted-foreground">{help.account.signedInLabel}</span>
          <span className="block font-medium break-words">{user.name}</span>
        </p>
        <div className="grid gap-0.5 border-t pt-2">
          {profileEnabled ? (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <UserRoundIcon aria-hidden className="size-4" />
              {help.account.profile}
            </Link>
          ) : null}
          <button
            type="button"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => {
                  setOpen(false);
                  router.push('/');
                },
              })
            }
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <LogOutIcon aria-hidden className="size-4" />
            {help.account.logout}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
