type ClassParts = {
  department: { short: string } | null;
  series: number | null;
  section?: string | null;
};

/** "CSE 2021, section A": the class a CR stands for. Null when the roll does not tell us. */
export function classLabel({ department, series, section }: ClassParts): string | null {
  if (!department || series === null) return null;
  return `${department.short} ${series}${section ? `, section ${section}` : ''}`;
}
