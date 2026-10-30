'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { help } from '../help';

/** The marketplace is for logged-in members; visitors get a login prompt. */
export function LoginGate({
  children,
}: {
  children: (user: { id: string; role: string }) => ReactNode;
}) {
  const session = useSession();
  if (session.isPending) {
    return <RuetLoader />;
  }
  if (!session.user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.login}</Link>
        </Button>
      </div>
    );
  }
  return children(session.user);
}
