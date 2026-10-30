import { help } from './help';

const BARS = [0, 1, 2, 3, 4];

/**
 * A cartoon of the RUET main gate: whitewashed pillars under an arched nameboard, the iron gates
 * swung open and a student walking in, with a kite drifting overhead. Inline SVG, theme colours
 * only (styles/theme.css, --art-*).
 */
export function RuetGate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 280" role="img" aria-label={help.gate.label} className={className}>
      {/* sky, sun, clouds, birds */}
      <rect width="480" height="280" rx="20" fill="var(--art-sky)" />
      <circle cx="406" cy="56" r="22" fill="var(--brand-orange)" opacity="0.85" />
      <g fill="var(--art-cloud)">
        <ellipse cx="78" cy="52" rx="30" ry="12" />
        <ellipse cx="100" cy="43" rx="20" ry="12" />
        <ellipse cx="330" cy="36" rx="24" ry="10" />
      </g>
      <g fill="none" stroke="var(--art-ink)" strokeWidth="2" strokeLinecap="round">
        <path d="M150 50q5-5 10 0q5-5 10 0" />
        <path d="M176 64q4-4 8 0q4-4 8 0" />
      </g>

      {/* a kite, because the field behind the gate is where they fly */}
      <g className="animate-drift motion-reduce:animate-none">
        <path d="M410 104l14 18-14 18-14-18z" fill="var(--brand-orange)" />
        <path d="M410 104v36M396 122h28" stroke="var(--art-cloud)" strokeWidth="1.5" />
        <path
          d="M410 140q-6 10 2 18t-2 18"
          fill="none"
          stroke="var(--art-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* grass and the road through the gate */}
      <rect y="222" width="480" height="58" fill="var(--art-grass)" />
      <path d="M206 222h68l46 58H160z" fill="var(--art-road)" />
      <path
        d="M240 230v10m0 10v12"
        stroke="var(--art-cloud)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* trees either side */}
      <rect x="40" y="168" width="10" height="56" rx="3" fill="var(--art-trunk)" />
      <circle cx="45" cy="156" r="28" fill="var(--art-tree)" />
      <circle cx="28" cy="172" r="16" fill="var(--art-tree-dark)" />
      <rect x="432" y="172" width="10" height="52" rx="3" fill="var(--art-trunk)" />
      <circle cx="437" cy="162" r="26" fill="var(--art-tree-dark)" />
      <circle cx="454" cy="176" r="14" fill="var(--art-tree)" />

      {/* boundary walls */}
      <rect x="70" y="182" width="96" height="42" fill="var(--art-concrete)" />
      <rect x="314" y="182" width="96" height="42" fill="var(--art-concrete)" />
      <g fill="var(--art-brick)">
        <rect x="70" y="178" width="96" height="6" rx="2" />
        <rect x="314" y="178" width="96" height="6" rx="2" />
      </g>
      <g fill="var(--art-concrete-dark)">
        <rect x="70" y="172" width="10" height="52" rx="2" />
        <rect x="400" y="172" width="10" height="52" rx="2" />
      </g>

      {/* pillars */}
      <rect x="160" y="96" width="34" height="128" fill="var(--art-concrete)" />
      <rect x="186" y="96" width="8" height="128" fill="var(--art-concrete-dark)" />
      <rect x="286" y="96" width="34" height="128" fill="var(--art-concrete)" />
      <rect x="312" y="96" width="8" height="128" fill="var(--art-concrete-dark)" />
      <rect x="154" y="216" width="46" height="8" rx="2" fill="var(--art-concrete-dark)" />
      <rect x="280" y="216" width="46" height="8" rx="2" fill="var(--art-concrete-dark)" />

      {/* arch and nameboard */}
      <path
        d="M152 82q88-58 176 0"
        fill="none"
        stroke="var(--art-concrete-dark)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect x="146" y="74" width="188" height="34" rx="6" fill="var(--art-concrete)" />
      <rect x="146" y="102" width="188" height="6" rx="2" fill="var(--art-concrete-dark)" />
      <text
        x="240"
        y="98"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        letterSpacing="6"
        fill="var(--primary)"
      >
        {help.gate.sign}
      </text>
      <rect x="206" y="66" width="68" height="4" rx="2" fill="var(--brand-orange)" />

      {/* iron gates, swung open */}
      <g stroke="var(--art-iron)" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <path d="M194 222V150l20 8v60z" />
        <path d="M286 222V150l-20 8v60z" />
        {BARS.map((bar) => (
          <path key={`l-${bar}`} d={`M${198 + bar * 3.5} ${152 + bar * 1.4}v${68 - bar * 0.6}`} />
        ))}
        {BARS.map((bar) => (
          <path key={`r-${bar}`} d={`M${282 - bar * 3.5} ${152 + bar * 1.4}v${68 - bar * 0.6}`} />
        ))}
      </g>

      {/* a student walking in, backpack on */}
      <g className="animate-bob motion-reduce:animate-none">
        <rect x="233" y="222" width="5" height="18" rx="2" fill="var(--art-ink)" />
        <rect x="242" y="222" width="5" height="18" rx="2" fill="var(--art-ink)" />
        <rect x="230" y="196" width="20" height="30" rx="7" fill="var(--primary)" />
        <rect x="233" y="200" width="14" height="18" rx="4" fill="var(--brand-orange)" />
        <circle cx="240" cy="188" r="9" fill="var(--art-hair)" />
      </g>
    </svg>
  );
}
