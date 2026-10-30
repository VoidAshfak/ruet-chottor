/** Outline of a toothed gear centred on (cx, cy), as one closed SVG path. */
export function gearPath(cx: number, cy: number, teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;
  // Fixed decimals so the server and the browser print the same path (no hydration mismatch).
  const point = (angle: number, r: number) =>
    `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    parts.push(
      point(a, inner),
      point(a + step * 0.12, outer),
      point(a + step * 0.42, outer),
      point(a + step * 0.54, inner),
    );
  }
  return `M${parts.join('L')}Z`;
}
