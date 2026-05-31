export function matchesTableNameFilter(name: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return name.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase());
}

export function filterRowsByName<T>(
  rows: readonly T[],
  query: string,
  getName: (row: T) => string,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return [...rows];
  return rows.filter((row) => matchesTableNameFilter(getName(row), trimmed));
}
