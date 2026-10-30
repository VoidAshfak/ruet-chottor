'use client';

import type { MediaAsset } from '@ruet-chottor/shared';
import { useState } from 'react';
import { help } from '../help';

/**
 * A photo of a found item is blurred until tapped, so a casual false claimant cannot simply describe
 * what they see. The poster always sees it clearly.
 */
export function ItemPhoto({
  photo,
  blurred,
  alt,
  thumbnail = false,
}: {
  photo: MediaAsset;
  blurred: boolean;
  alt: string;
  thumbnail?: boolean;
}) {
  const [revealed, setRevealed] = useState(!blurred);
  const src = thumbnail ? (photo.thumbnailUrl ?? photo.url) : photo.url;

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      {/* Cloudinary serves a size that fits; next/image would resize it again on our server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={revealed ? alt : help.detail.photoHidden}
        loading="lazy"
        className={`w-full object-cover ${thumbnail ? 'aspect-[4/3]' : 'max-h-96'} ${revealed ? '' : 'scale-110 blur-xl'}`}
      />
      {revealed || thumbnail ? null : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex items-center justify-center text-sm font-medium text-foreground"
        >
          <span className="rounded-md bg-background/90 px-3 py-1.5">{help.detail.showPhoto}</span>
        </button>
      )}
    </div>
  );
}
