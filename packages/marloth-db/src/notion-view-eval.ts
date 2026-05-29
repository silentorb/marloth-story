export interface EvalRow {
  nodeId: string;
  name: string;
  cells: Record<string, string>;
  rowIndex: number;
  createdAt: string | null;
  modifiedAt: string | null;
}

function cellValue(row: EvalRow, propertyName: string): string | null {
  const direct = row.cells[propertyName];
  if (direct !== undefined && direct !== "") return direct;
  const slug = propertyName.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  for (const [key, value] of Object.entries(row.cells)) {
    if (key.toLowerCase() === slug) return value;
  }
  return null;
}

function parseBool(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function compareStrings(a: string | null, b: string | null): number {
  const left = a ?? "";
  const right = b ?? "";
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbers(a: string | null, b: string | null): number {
  const na = a !== null ? Number.parseFloat(a) : NaN;
  const nb = b !== null ? Number.parseFloat(b) : NaN;
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return compareStrings(a, b);
}

export function matchesNotionFilter(row: EvalRow, filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;

  const obj = filter as Record<string, unknown>;

  if (obj.and && Array.isArray(obj.and)) {
    return obj.and.every((child) => matchesNotionFilter(row, child));
  }
  if (obj.or && Array.isArray(obj.or)) {
    return obj.or.some((child) => matchesNotionFilter(row, child));
  }

  const property = typeof obj.property === "string" ? obj.property : null;
  if (!property) return true;

  const value = cellValue(row, property);

  if ("checkbox" in obj) {
    const cond = obj.checkbox as { equals?: boolean };
    const rowBool = parseBool(value);
    if (cond.equals === undefined) return rowBool !== null;
    return rowBool === cond.equals;
  }

  if ("select" in obj) {
    const cond = obj.select as { equals?: string; is_empty?: boolean; is_not_empty?: boolean };
    if (cond.is_empty) return !value;
    if (cond.is_not_empty) return Boolean(value);
    if (cond.equals !== undefined) return value === cond.equals;
  }

  if ("status" in obj) {
    const cond = obj.status as { equals?: string; is_empty?: boolean; is_not_empty?: boolean };
    if (cond.is_empty) return !value;
    if (cond.is_not_empty) return Boolean(value);
    if (cond.equals !== undefined) return value === cond.equals;
  }

  if ("rich_text" in obj || "title" in obj) {
    const key = "rich_text" in obj ? "rich_text" : "title";
    const cond = obj[key] as {
      equals?: string;
      contains?: string;
      is_empty?: boolean;
      is_not_empty?: boolean;
    };
    if (cond.is_empty) return !value;
    if (cond.is_not_empty) return Boolean(value);
    if (cond.equals !== undefined) return value === cond.equals;
    if (cond.contains !== undefined) {
      return value !== null && value.toLowerCase().includes(cond.contains.toLowerCase());
    }
  }

  if ("number" in obj) {
    const cond = obj.number as {
      equals?: number;
      greater_than?: number;
      less_than?: number;
      is_empty?: boolean;
      is_not_empty?: boolean;
    };
    const num = value !== null ? Number.parseFloat(value) : NaN;
    if (cond.is_empty) return !Number.isFinite(num);
    if (cond.is_not_empty) return Number.isFinite(num);
    if (cond.equals !== undefined) return num === cond.equals;
    if (cond.greater_than !== undefined) return num > cond.greater_than;
    if (cond.less_than !== undefined) return num < cond.less_than;
  }

  if ("date" in obj) {
    const cond = obj.date as {
      equals?: string;
      before?: string;
      after?: string;
      is_empty?: boolean;
      is_not_empty?: boolean;
    };
    const start = value?.split("→")[0]?.trim() ?? value;
    const ts = start ? Date.parse(start) : NaN;
    if (cond.is_empty) return !Number.isFinite(ts);
    if (cond.is_not_empty) return Number.isFinite(ts);
    if (cond.equals !== undefined) return start === cond.equals;
    if (cond.before !== undefined) return Number.isFinite(ts) && ts < Date.parse(cond.before);
    if (cond.after !== undefined) return Number.isFinite(ts) && ts > Date.parse(cond.after);
  }

  return true;
}

export function sortEvalRows(rows: EvalRow[], sorts: unknown[]): EvalRow[] {
  if (!sorts.length) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    for (const sort of sorts) {
      if (!sort || typeof sort !== "object") continue;
      const s = sort as Record<string, unknown>;
      const direction = s.direction === "descending" ? -1 : 1;

      if (s.timestamp === "created_time") {
        const cmp = compareStrings(a.createdAt, b.createdAt) * direction;
        if (cmp !== 0) return cmp;
        continue;
      }
      if (s.timestamp === "last_edited_time") {
        const cmp = compareStrings(a.modifiedAt, b.modifiedAt) * direction;
        if (cmp !== 0) return cmp;
        continue;
      }

      const property = typeof s.property === "string" ? s.property : null;
      if (!property) continue;
      const av = cellValue(a, property);
      const bv = cellValue(b, property);
      const cmp = compareNumbers(av, bv) * direction;
      if (cmp !== 0) return cmp;
    }
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return copy;
}

export function filterEvalRows(rows: EvalRow[], filter: unknown | null): EvalRow[] {
  if (!filter) return rows;
  return rows.filter((row) => matchesNotionFilter(row, filter));
}
