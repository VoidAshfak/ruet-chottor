'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useStaff } from '../hooks/use-admin';

/** Shows children only to moderators and admins; explains why otherwise. */
export function StaffOnly({ children }: { children: ReactNode }) {
  const { user, isPending, isStaff } = useStaff();

  if (isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {help.states.loading}
      </p>
    );
  }
  if (!user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.states.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.states.login}</Link>
        </Button>
      </div>
    );
  }
  if (!isStaff) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.states.staffOnly}</p>;
  }
  return children;
}
