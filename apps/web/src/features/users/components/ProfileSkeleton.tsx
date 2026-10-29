import { help } from '../help';

/** Same footprint as ProfileDetails, so the page does not jump when data arrives. */
export function ProfileSkeleton() {
  return (
    <div role="status" className="rounded-lg border p-4 sm:p-6">
      <span className="sr-only">{help.states.loading}</span>
      <div className="h-7 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-5 w-full max-w-sm animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
