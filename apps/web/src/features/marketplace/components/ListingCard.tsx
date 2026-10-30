import type { Listing } from '@ruet-chottor/shared';
import Link from 'next/link';
import { help } from '../help';

/** One listing in a grid: photo, price, title, condition. */
export function ListingCard({
  listing,
  showState = false,
}: {
  listing: Listing;
  showState?: boolean;
}) {
  const photo = listing.photos[0];
  const badge = listing.heldFor
    ? help.browse.heldLabel
    : listing.expired
      ? help.browse.expiredLabel
      : listing.state !== 'available'
        ? help.states[listing.state]
        : null;
  return (
    <li className="overflow-hidden rounded-lg border">
      <Link href={`/marketplace/${listing.id}`} className="grid gap-1 hover:bg-accent/50">
        {photo?.thumbnailUrl ? (
          // Cloudinary serves a small optimised thumbnail; next/image would resize it again on our server.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumbnailUrl}
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full bg-muted object-cover"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-muted" aria-hidden />
        )}
        <div className="grid gap-0.5 p-3">
          <span className="font-semibold text-primary">{help.price(listing.priceTaka)}</span>
          <span className="line-clamp-2 break-words">{listing.title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {help.conditions[listing.condition]}
            {badge && (showState || listing.state === 'reserved') ? (
              <span className="rounded-full border px-2 py-0.5">{badge}</span>
            ) : null}
          </span>
        </div>
      </Link>
    </li>
  );
}
