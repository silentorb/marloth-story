export interface NotionPropertyDefinition {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface NotionDatabaseSchema {
  syncedAt: string;
  properties: Record<string, NotionPropertyDefinition>;
}

export interface NotionViewDefinition {
  id: string;
  name: string;
  type: string;
  filter: unknown | null;
  sorts: unknown[];
  visiblePropertyIds: string[];
  configuration: unknown | null;
}

export interface NotionDatabaseViews {
  syncedAt: string;
  views: NotionViewDefinition[];
}

export function parseNotionSchema(raw: unknown): NotionDatabaseSchema | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as NotionDatabaseSchema;
  } catch {
    return null;
  }
}

export function parseNotionViews(raw: unknown): NotionDatabaseViews | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as NotionDatabaseViews;
  } catch {
    return null;
  }
}

export function propertyNamesById(schema: NotionDatabaseSchema): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, def] of Object.entries(schema.properties)) {
    map.set(def.id, name);
  }
  return map;
}

export function slugifyPropertyKey(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/[^a-z0-9_]+/g, "_");
  s = s.replace(/^_+|_+$/g, "").replace(/__+/g, "_");
  if (!s) s = "property";
  if (/^\d/.test(s)) s = `prop_${s}`;
  return s;
}

export function resolveViewByKey(
  views: NotionViewDefinition[],
  requested?: string,
): NotionViewDefinition | null {
  if (views.length === 0) return null;
  if (!requested) return views[0]!;
  const normalized = requested.trim().toLowerCase();
  return (
    views.find((v) => v.id.toLowerCase() === normalized) ??
    views.find((v) => v.name.toLowerCase() === normalized) ??
    views.find((v) => slugifyPropertyKey(v.name) === normalized) ??
    views[0]!
  );
}
