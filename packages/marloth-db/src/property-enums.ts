import type { DatabaseColumnDef } from "./database-view";

/** Workspace-wide priority enum id (shared across table views). */
export const PRIORITY_ENUM_ID = "priority";

/** Canonical priority labels stored on connections; not numeric weights. */
export const PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Ultimate",
  "Consideration",
  "Cancelled",
] as const;

export type PriorityValue = (typeof PRIORITY_OPTIONS)[number];

/** Default when priority is unset (no empty/unassigned state in the UI). */
export const PRIORITY_DEFAULT: PriorityValue = "Low";

/** Numeric weights for dynamic fields (e.g. inspirations.weightedUse). */
export const PRIORITY_WEIGHT: Record<PriorityValue, number> = {
  Low: 1,
  Medium: 2,
  High: 4,
  Ultimate: 8,
  Consideration: 0,
  Cancelled: 0,
};

export function isPriorityColumnKey(key: string): boolean {
  return key.trim().toLowerCase() === PRIORITY_ENUM_ID;
}

export function isPriorityPropertyName(name: string): boolean {
  return name.trim().toLowerCase() === "priority";
}

export function isPriorityValue(value: string): value is PriorityValue {
  return (PRIORITY_OPTIONS as readonly string[]).includes(value);
}

export function priorityWeight(priority: unknown): number {
  if (typeof priority !== "string" || !priority.trim()) {
    return PRIORITY_WEIGHT[PRIORITY_DEFAULT];
  }
  return PRIORITY_WEIGHT[priority as PriorityValue] ?? 0;
}

export function coalescePriorityValue(value: string | null | undefined): PriorityValue {
  if (value && isPriorityValue(value)) return value;
  return PRIORITY_DEFAULT;
}

export function isUnsetPriority(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

export function enrichColumnDef(def: DatabaseColumnDef): DatabaseColumnDef {
  if (!isPriorityColumnKey(def.key) && !isPriorityPropertyName(def.name)) {
    return def;
  }
  return {
    ...def,
    type: "enum",
    enumId: PRIORITY_ENUM_ID,
    options: [...PRIORITY_OPTIONS],
    defaultValue: PRIORITY_DEFAULT,
  };
}

export function enrichColumnDefs(defs: DatabaseColumnDef[]): DatabaseColumnDef[] {
  return defs.map(enrichColumnDef);
}
