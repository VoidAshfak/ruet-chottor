import type { EventClass } from '@ruet-chottor/shared';

/** "CSE 2021 · Section A": the class a CR's event is for. */
export function classLabel(value: EventClass): string {
  const department = value.department?.short ?? '?';
  return `${department} ${value.series}${value.section ? ` · Section ${value.section}` : ''}`;
}
