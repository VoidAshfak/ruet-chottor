import type { MediaAsset } from '@ruet-chottor/shared';
import { help } from '../help';

/** The club's logo, or its initials on a tinted square. */
export function ClubLogo({
  name,
  logo,
  size = 'md',
}: {
  name: string;
  logo: MediaAsset | null;
  size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'size-20 text-2xl' : 'size-12 text-base';
  if (logo?.thumbnailUrl) {
    return (
      // Cloudinary already serves a small optimised image; next/image would resize it again on our server.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.thumbnailUrl}
        alt={help.detail.logoAlt(name)}
        className={`${box} shrink-0 rounded-lg border object-cover`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter((word) => /^[a-z0-9]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-accent-foreground`}
    >
      {initials}
    </span>
  );
}
