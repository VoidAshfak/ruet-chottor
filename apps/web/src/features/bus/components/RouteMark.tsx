import type { BusColor } from '@ruet-chottor/shared';

// Full class names, so Tailwind sees them (theme tokens --route-*).
const DOT: Record<BusColor, string> = {
  blue: 'bg-route-blue',
  orange: 'bg-route-orange',
  green: 'bg-route-green',
  red: 'bg-route-red',
  purple: 'bg-route-purple',
  teal: 'bg-route-teal',
};

/** A coloured dot before a route name; the colour is decoration, the name carries the meaning. */
export function RouteMark({ color, name }: { color: BusColor; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${DOT[color]}`} />
      <span>{name}</span>
    </span>
  );
}

export function colorClass(color: BusColor): string {
  return DOT[color];
}
