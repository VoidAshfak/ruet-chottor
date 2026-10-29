import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { help } from '../help';

export function LoginNeeded() {
  return (
    <div className="rounded-lg border p-6 text-center">
      <p className="text-muted-foreground">{help.states.loginNeeded}</p>
      <Button asChild className="mt-4">
        <Link href="/login">{help.states.login}</Link>
      </Button>
    </div>
  );
}
