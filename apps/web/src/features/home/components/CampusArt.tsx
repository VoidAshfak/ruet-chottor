/**
 * A cartoon of campus life at RUET: a red-brick academic block, the chottor (square) in front of
 * it, a Rajshahi mango tree, a painted rickshaw and two students planning an adda by the Padma.
 * Inline SVG, so it costs no request; every color is a theme token (styles/theme.css, --art-*).
 */
export function CampusArt({ label, bubble }: { label: string; bubble: string }) {
  const windows = [0, 1, 2].flatMap((row) =>
    [0, 1, 2, 3, 4].map((col) => ({ x: 52 + col * 36, y: 124 + row * 28, key: `${row}-${col}` })),
  );
  const mangoes = [
    [410, 150],
    [452, 128],
    [476, 168],
    [430, 182],
    [396, 176],
    [462, 150],
  ];

  return (
    <svg viewBox="0 0 520 320" role="img" aria-label={label} className="h-auto w-full">
      {/* sky, sun, clouds, birds */}
      <rect width="520" height="320" rx="24" fill="var(--art-sky)" />
      <circle cx="456" cy="58" r="26" fill="var(--brand-orange)" opacity="0.85" />
      <g fill="var(--art-cloud)">
        <ellipse cx="110" cy="58" rx="34" ry="14" />
        <ellipse cx="134" cy="48" rx="22" ry="14" />
        <ellipse cx="300" cy="40" rx="30" ry="12" />
        <ellipse cx="320" cy="32" rx="18" ry="11" />
      </g>
      <g fill="none" stroke="var(--art-ink)" strokeWidth="2" strokeLinecap="round">
        <path d="M352 82q6-6 12 0q6-6 12 0" />
        <path d="M384 98q5-5 10 0q5-5 10 0" />
      </g>

      {/* grass and the Padma */}
      <rect y="232" width="520" height="88" fill="var(--art-grass)" />
      <path d="M0 290c60-10 120 10 180 0s120-10 180 0 100 10 160 0v30H0z" fill="var(--art-river)" />
      <g fill="none" stroke="var(--art-cloud)" strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <path d="M60 306q10-4 20 0" />
        <path d="M250 302q10-4 20 0" />
        <path d="M420 308q10-4 20 0" />
      </g>

      {/* academic block */}
      <rect x="34" y="102" width="202" height="12" rx="2" fill="var(--art-brick-dark)" />
      <rect x="40" y="112" width="190" height="122" fill="var(--art-brick)" />
      {windows.map((w) => (
        <rect key={w.key} x={w.x} y={w.y} width="22" height="18" rx="2" fill="var(--art-window)" />
      ))}
      <path d="M118 234v-26a17 17 0 0 1 34 0v26z" fill="var(--art-brick-dark)" />
      {/* the chottor in front of it */}
      <path d="M120 234h30l40 56H80z" fill="var(--art-window)" opacity="0.7" />

      {/* mango tree */}
      <rect x="428" y="168" width="16" height="72" rx="4" fill="var(--art-trunk)" />
      <circle cx="404" cy="168" r="30" fill="var(--art-tree-dark)" />
      <circle cx="470" cy="164" r="32" fill="var(--art-tree-dark)" />
      <circle cx="436" cy="140" r="44" fill="var(--art-tree)" />
      {mangoes.map(([x, y]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="5" ry="7" fill="var(--art-mango)" />
      ))}

      {/* rickshaw with its puller */}
      <g>
        <path d="M300 232c0-30 22-46 46-46v46z" fill="var(--brand-orange)" />
        <path d="M312 214h34" stroke="var(--primary)" strokeWidth="5" />
        <rect x="300" y="232" width="52" height="16" rx="3" fill="var(--primary)" />
        <circle cx="314" cy="240" r="3" fill="var(--art-mango)" />
        <circle cx="326" cy="240" r="3" fill="var(--art-cloud)" />
        <circle cx="338" cy="240" r="3" fill="var(--art-mango)" />
        <path
          d="M346 250l40 6m-2-28v28"
          fill="none"
          stroke="var(--art-ink)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="326" cy="266" r="20" fill="none" stroke="var(--art-ink)" strokeWidth="4" />
        <path d="M326 246v40M306 266h40" stroke="var(--art-ink)" strokeWidth="1.5" />
        <circle cx="398" cy="272" r="13" fill="none" stroke="var(--art-ink)" strokeWidth="4" />
        <rect x="378" y="220" width="18" height="26" rx="6" fill="var(--art-cloud)" />
        <circle cx="387" cy="210" r="9" fill="var(--art-skin)" />
        <path d="M378 206a9 9 0 0 1 18 0z" fill="var(--art-hair)" />
        <path
          d="M387 246l-6 22m6-22l10 20"
          stroke="var(--art-ink)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      {/* two students planning an adda */}
      <g>
        <rect x="166" y="232" width="8" height="34" rx="3" fill="var(--art-ink)" />
        <rect x="178" y="232" width="8" height="34" rx="3" fill="var(--art-ink)" />
        <rect x="160" y="196" width="32" height="42" rx="10" fill="var(--primary)" />
        <rect x="186" y="210" width="16" height="20" rx="2" fill="var(--brand-orange)" />
        <circle cx="176" cy="182" r="14" fill="var(--art-skin)" />
        <path d="M162 180a14 14 0 0 1 28 0c-6-6-16-6-28 0z" fill="var(--art-hair)" />

        <rect x="230" y="232" width="8" height="34" rx="3" fill="var(--art-ink)" />
        <rect x="242" y="232" width="8" height="34" rx="3" fill="var(--art-ink)" />
        <rect x="216" y="200" width="12" height="28" rx="4" fill="var(--art-trunk)" />
        <rect x="224" y="196" width="32" height="42" rx="10" fill="var(--brand-green)" />
        <path d="M256 204l14-14" stroke="var(--art-skin)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="240" cy="182" r="14" fill="var(--art-skin)" />
        <path
          d="M226 184c0-12 6-18 14-18s14 6 14 18c-2-6-6-9-14-9s-12 3-14 9z"
          fill="var(--art-hair)"
        />
      </g>

      {/* speech bubble */}
      <g>
        <rect
          x="244"
          y="118"
          width="148"
          height="38"
          rx="12"
          fill="var(--art-cloud)"
          stroke="var(--art-ink)"
          strokeWidth="1.5"
        />
        <path
          d="M262 155l-8 16 20-16"
          fill="var(--art-cloud)"
          stroke="var(--art-ink)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M263 154h12" stroke="var(--art-cloud)" strokeWidth="3" />
        <text
          x="318"
          y="143"
          textAnchor="middle"
          fontSize="16"
          fontWeight="600"
          fill="var(--art-ink)"
        >
          {bubble}
        </text>
      </g>
    </svg>
  );
}
