'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useLogout, useSession } from '../hooks/use-session';

/** Header corner: log in / sign up for visitors, name + log out for members. */
export function AccountMenu() {
  const router = useRouter();
  const { user, isPending } = useSession();
  const logout = useLogout();

  // Same-size placeholder while loading, so the header does not jump.
  if (isPending) return <div className="h-8 w-28" aria-hidden />;

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
    <div className="flex shrink-0 items-center gap-2">
      <span
        className="hidden max-w-40 truncate text-sm sm:inline"
        title={help.account.signedInAs(user.name)}
      >
        {user.name}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => router.push('/') })}
      >
        {help.account.logout}
      </Button>
    </div>
  );
}
