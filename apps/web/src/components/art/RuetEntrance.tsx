import { help } from './help';

const TRUSS_PANELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const GATE_BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SHRUBS: [number, number, number][] = [
  [292, 196, 22],
  [330, 190, 26],
  [372, 192, 24],
  [438, 192, 24],
  [480, 190, 26],
  [518, 196, 22],
];

/** One sliding gate: a light frame of upright bars with a solid band across the middle. */
function SlidingGate({ x }: { x: number }) {
  return (
    <g>
      <g stroke="var(--art-gate-wall-dark)" strokeWidth="1.5">
        {GATE_BARS.map((bar) => (
          <path key={bar} d={`M${x + 4 + bar * 10} 160v38`} />
        ))}
      </g>
      <rect
        x={x}
        y="156"
        width="122"
        height="44"
        fill="none"
        stroke="var(--art-gate-wall-dark)"
        strokeWidth="2.5"
      />
      <rect x={x} y="172" width="122" height="12" fill="var(--art-iron)" opacity="0.55" />
    </g>
  );
}

/** A gatekeeper's booth on its brick plinth, with IN or OUT on the front. */
function Booth({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x - 22} y="204" width="108" height="6" rx="2" fill="var(--art-brick)" />
      <rect x={x - 22} y="210" width="108" height="6" rx="2" fill="var(--art-brick-dark)" />
      <rect x={x} y="150" width="64" height="54" fill="var(--art-gate-wall)" />
      <rect x={x + 46} y="150" width="18" height="54" fill="var(--art-gate-wall-dark)" />
      <text
        x={x + 23}
        y="172"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="var(--art-ink)"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * The RUET entrance gate, drawn for the footer: the name pillar in front of the gatehouse, the steel
 * truss reaching left, the arc sweeping right, the round planter and the IN/OUT gates. Theme colours
 * only (styles/theme.css, --art-*); the university emblem is left out on purpose (CLAUDE.md §9).
 */
export function RuetEntrance({ className }: { className?: string }) {
  const text = help.entrance;
  return (
    <svg viewBox="0 0 800 228" role="img" aria-label={text.label} className={className}>
      {/* birds */}
      <g fill="none" stroke="var(--art-trunk)" strokeWidth="2" strokeLinecap="round">
        <path d="M128 22q6-6 12 0q6-6 12 0" />
        <path d="M206 50q4-4 8 0q4-4 8 0" />
        <path d="M586 40q4-4 8 0q4-4 8 0" />
        <g className="animate-drift motion-reduce:animate-none">
          <path d="M650 70q5-5 10 0q5-5 10 0" />
        </g>
      </g>

      {/* ground */}
      <path d="M0 214h800" stroke="var(--border)" strokeWidth="2" />

      {/* steel truss on its post, reaching to the pillar */}
      <rect x="68" y="66" width="10" height="86" fill="var(--art-gate-wall-dark)" />
      <g fill="none" stroke="var(--art-ink)" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M34 56h340M34 72h340M34 56v16" />
        <path
          d={TRUSS_PANELS.map((panel) => `M${34 + panel * 34} 72l17-16 17 16`).join('')}
          strokeWidth="2"
        />
      </g>

      {/* gatehouse behind the pillar */}
      <rect x="292" y="112" width="216" height="10" fill="var(--art-gate-wall-dark)" />
      <rect x="300" y="122" width="200" height="80" fill="var(--art-gate-wall)" />
      <g fill="var(--primary)">
        <rect x="306" y="132" width="30" height="40" />
        <rect x="464" y="132" width="30" height="40" />
      </g>
      <g stroke="var(--art-gate-wall)" strokeWidth="2">
        <path d="M321 132v40M306 150h30M479 132v40M464 150h30" />
      </g>

      {/* the low curved wall wrapping round the pillar */}
      <path
        d="M430 196c40-6 76-28 96-60l14 4c-20 36-58 60-104 66z"
        fill="var(--art-gate-wall-dark)"
      />

      {/* the great arc, from behind the pillar down past the OUT booth */}
      <path
        d="M330 46C540 40 756 96 768 208h-16C740 112 540 66 330 62z"
        fill="var(--art-gate-arc)"
        stroke="var(--art-gate-wall-dark)"
        strokeWidth="1.5"
      />

      {/* name pillar */}
      <rect x="340" y="24" width="120" height="8" fill="var(--art-gate-wall-dark)" />
      <rect x="344" y="32" width="112" height="170" fill="var(--art-gate-wall)" />
      <rect x="440" y="32" width="16" height="170" fill="var(--art-gate-wall-dark)" opacity="0.6" />
      <rect x="370" y="60" width="44" height="3" rx="1.5" fill="var(--brand-orange)" />
      <g textAnchor="middle" fill="var(--art-ink)" fontWeight="600">
        {text.name.map((line, index) => (
          <text key={line} x="392" y={98 + index * 18} fontSize={index === 1 ? 11 : 12.5}>
            {line}
          </text>
        ))}
      </g>

      {/* sliding gates and booths */}
      <SlidingGate x={150} />
      <SlidingGate x={528} />
      <Booth x={86} label={text.in} />
      <Booth x={664} label={text.out} />

      {/* round planter with shrubs */}
      <ellipse cx="405" cy="210" rx="150" ry="10" fill="var(--art-brick-dark)" />
      <path d="M255 200h300v10H255z" fill="var(--art-brick)" />
      <ellipse cx="405" cy="200" rx="150" ry="9" fill="var(--art-brick)" />
      {SHRUBS.map(([cx, cy, r]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.6} fill="var(--art-shrub-dark)" />
          <ellipse cx={cx} cy={cy - 3} rx={r * 0.8} ry={r * 0.45} fill="var(--art-shrub)" />
        </g>
      ))}
    </svg>
  );
}
