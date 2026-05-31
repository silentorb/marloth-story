import { resolveContentPath } from "./content/paths";
import type { DatabaseColumnDef } from "./database-view";
import { loadSchemaFromContent } from "./schema-rules/load";
import type { EnumDefinition, SchemaFile } from "./schema-rules/schema-file";

/** Workspace-wide priority enum id (shared across table views). */
export const PRIORITY_ENUM_ID = "priority";

const FALLBACK_PRIORITY = {
  options: ["Low", "Medium", "High", "Consideration"] as const,
  default: "Low",
  values: {
    Low: 1,
    Medium: 2,
    High: 4,
    Consideration: 0,
  },
} satisfies EnumDefinition;

export type PriorityValue = (typeof FALLBACK_PRIORITY.options)[number];

export function resolvePropertyEnum(enumId: string, schema?: SchemaFile): EnumDefinition | null {
  const id = enumId.trim();
  if (!id) return null;
  const def = schema?.enums[id];
  if (def) return def;
  if (id === PRIORITY_ENUM_ID) return FALLBACK_PRIORITY;
  return null;
}

export function resolvePropertyEnumFromContent(
  enumId: string,
  contentDir?: string,
): EnumDefinition | null {
  const schema = loadSchemaFromContent(contentDir ?? resolveContentPath());
  return resolvePropertyEnum(enumId, schema);
}

export function resolvePriorityEnum(schema?: SchemaFile): EnumDefinition {
  return resolvePropertyEnum(PRIORITY_ENUM_ID, schema) ?? FALLBACK_PRIORITY;
}

function activePriority(): EnumDefinition {
  return resolvePropertyEnumFromContent(PRIORITY_ENUM_ID) ?? FALLBACK_PRIORITY;
}

/** Priority labels from schema.json (or fallback when schema is missing). */
export function getPriorityOptions(): readonly string[] {
  return activePriority().options;
}

/** Default priority label from schema.json (or fallback). */
export function getPriorityDefault(): string {
  return activePriority().default;
}

/** Priority numeric values from schema.json, interpreted as weights by consumers. */
export function getPriorityValues(): Record<string, number> {
  return { ...(activePriority().values ?? {}) };
}

/** @deprecated Use getPriorityOptions() */
export const PRIORITY_OPTIONS = FALLBACK_PRIORITY.options;

/** @deprecated Use getPriorityDefault() */
export const PRIORITY_DEFAULT: PriorityValue = FALLBACK_PRIORITY.default as PriorityValue;

/** @deprecated Use getPriorityValues() */
export const PRIORITY_WEIGHT: Record<string, number> = FALLBACK_PRIORITY.values ?? {};

export function isPriorityColumnKey(key: string): boolean {
  return key.trim().toLowerCase() === PRIORITY_ENUM_ID;
}

export function isPriorityPropertyName(name: string): boolean {
  return name.trim().toLowerCase() === "priority";
}

function enumIdForColumn(def: DatabaseColumnDef, schema: SchemaFile): string | null {
  const key = def.key.trim().toLowerCase();
  if (schema.enums[key]) return key;
  const name = def.name.trim().toLowerCase();
  if (schema.enums[name]) return name;
  if (name === "priority" && schema.enums[PRIORITY_ENUM_ID]) return PRIORITY_ENUM_ID;
  if (key === PRIORITY_ENUM_ID && resolvePropertyEnum(PRIORITY_ENUM_ID, schema)) return PRIORITY_ENUM_ID;
  return null;
}

export function isPriorityValue(value: string): value is PriorityValue {
  return getPriorityOptions().includes(value);
}

export function priorityWeight(priority: unknown): number {
  const def = activePriority();
  const values = def.values ?? {};
  const defaultValue = def.default;
  if (typeof priority !== "string" || !priority.trim()) {
    return values[defaultValue] ?? 0;
  }
  return values[priority] ?? 0;
}

export function coalescePriorityValue(value: string | null | undefined): PriorityValue {
  if (value && isPriorityValue(value)) return value;
  return getPriorityDefault() as PriorityValue;
}

export function isUnsetPriority(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

export function enrichColumnDef(def: DatabaseColumnDef, schema?: SchemaFile): DatabaseColumnDef {
  const resolvedSchema = schema ?? loadSchemaFromContent(resolveContentPath());
  const enumId = enumIdForColumn(def, resolvedSchema);
  if (!enumId) {
    return def;
  }
  const enumDef = resolvePropertyEnum(enumId, resolvedSchema);
  if (!enumDef) {
    return def;
  }
  return {
    ...def,
    type: "enum",
    enumId,
    options: [...enumDef.options],
    defaultValue: enumDef.default,
  };
}

export function enrichColumnDefs(defs: DatabaseColumnDef[], schema?: SchemaFile): DatabaseColumnDef[] {
  const resolvedSchema = schema ?? loadSchemaFromContent(resolveContentPath());
  return defs.map((def) => enrichColumnDef(def, resolvedSchema));
}
