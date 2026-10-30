import type { NewsPost } from '@ruet-chottor/shared';
import { help } from '../help';

/** Shown to the author (and staff) on posts that are not simply published. */
export function ReviewBadge({ post }: { post: NewsPost }) {
  if (post.moderated) {
    return <p className="rounded-md bg-muted px-3 py-2 text-sm">{help.reviewHint.moderated}</p>;
  }
  if (post.review === 'approved') return null;
  return (
    <div className="rounded-md bg-muted px-3 py-2 text-sm">
      <p>
        <span className="font-medium">{help.review[post.review]}.</span>{' '}
        {help.reviewHint[post.review]}
      </p>
      {post.review === 'rejected' && post.reviewNote ? (
        <p className="mt-1 break-words text-muted-foreground">
          {help.moderatorNote}: {post.reviewNote}
        </p>
      ) : null}
    </div>
  );
}
