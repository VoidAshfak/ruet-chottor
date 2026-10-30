import { help } from './help';

/** For the 404 page: a student puzzling over a campus map, question marks floating above. */
export function LostArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" role="img" aria-label={help.lost} className={className}>
      <ellipse cx="120" cy="186" rx="80" ry="8" fill="var(--accent)" />
      {/* question marks */}
      <g
        fill="var(--brand-orange)"
        fontSize="28"
        fontWeight="700"
        className="animate-bob motion-reduce:animate-none"
      >
        <text x="64" y="48">
          ?
        </text>
        <text x="160" y="36" fontSize="22">
          ?
        </text>
        <text x="182" y="72" fontSize="16">
          ?
        </text>
      </g>
      {/* legs and body */}
      <rect x="104" y="140" width="10" height="44" rx="4" fill="var(--art-ink)" />
      <rect x="122" y="140" width="10" height="44" rx="4" fill="var(--art-ink)" />
      <rect x="96" y="92" width="44" height="56" rx="14" fill="var(--primary)" />
      {/* head, scratching it */}
      <circle cx="118" cy="74" r="18" fill="var(--art-skin)" />
      <path d="M100 72a18 18 0 0 1 36 0c-8-8-22-8-36 0z" fill="var(--art-hair)" />
      <path d="M138 100l14-24" stroke="var(--art-skin)" strokeWidth="8" strokeLinecap="round" />
      {/* the map, upside down */}
      <g transform="rotate(-10 84 116)">
        <rect x="52" y="98" width="64" height="44" rx="3" fill="var(--art-window)" />
        <path d="M73 98v44M94 98v44" stroke="var(--art-concrete-dark)" strokeWidth="1.5" />
        <path
          d="M58 132q12-20 26-6t26-18"
          fill="none"
          stroke="var(--brand-green)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <circle cx="108" cy="108" r="3" fill="var(--route-red)" />
      </g>
    </svg>
  );
}
