import { Button } from '@/components/ui/button';
import { help } from '../help';

export function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border p-6 text-center">
      <p className="text-destructive">{message ?? help.states.error}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        {help.states.retry}
      </Button>
    </div>
  );
}
