import type { MediaAsset } from '@ruet-chottor/shared';
import { help } from './help';

/**
 * Shows attached photos and videos. Everything is served by Cloudinary's CDN in a size and format
 * that fits the device, and loads only when scrolled into view.
 */
export function MediaGallery({ assets }: { assets: MediaAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <ul className={`grid gap-2 ${assets.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {assets.map((asset, index) => (
        <li key={asset.id} className="overflow-hidden rounded-lg border bg-muted">
          {asset.kind === 'video' ? (
            <video
              src={asset.url}
              poster={asset.thumbnailUrl ?? undefined}
              controls
              preload="none"
              aria-label={help.video(index + 1)}
              className="w-full"
            />
          ) : (
            // Cloudinary already resizes and compresses; next/image would do it again on our server.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={help.imageAlt(index + 1)}
              loading="lazy"
              width={asset.width ?? undefined}
              height={asset.height ?? undefined}
              className="h-auto w-full"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
