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
    try {
      const decoded = decodeURIComponent(def.id);
      if (decoded !== def.id) map.set(decoded, name);
    } catch {
      /* leave encoded id only */
    }
  }
  return map;
}

export function propertyNameForId(
  idToName: Map<string, string>,
  propertyId: string,
): string | undefined {
  return (
    idToName.get(propertyId) ??
    idToName.get(encodeURIComponent(propertyId)) ??
    (() => {
      try {
        return idToName.get(decodeURIComponent(propertyId));
      } catch {
        return undefined;
      }
    })()
  );
}

/** Notion property types stored on IS_A edges (editable instance scalars). */
const STORED_SCALAR_PROPERTY_TYPES = new Set([
  "checkbox",
  "date",
  "email",
  "files",
  "multi_select",
  "number",
  "phone_number",
  "rich_text",
  "select",
  "status",
  "text",
  "url",
]);

/** Notion types that are computed or not stored on membership edges. */
const NON_STORED_SCALAR_PROPERTY_TYPES = new Set([
  "created_by",
  "created_time",
  "formula",
  "last_edited_by",
  "last_edited_time",
  "relation",
  "rollup",
  "title",
]);

export function isStoredScalarPropertyType(type: string): boolean {
  if (NON_STORED_SCALAR_PROPERTY_TYPES.has(type)) return false;
  if (STORED_SCALAR_PROPERTY_TYPES.has(type)) return true;
  return type !== "title" && type !== "relation";
}

export function storedScalarColumnDefsFromSchema(
  schema: NotionDatabaseSchema,
  enrich: (def: { key: string; name: string; type: string }) => {
    key: string;
    name: string;
    type: string;
  },
): { key: string; name: string; type: string }[] {
  const columnDefs: { key: string; name: string; type: string }[] = [];
  for (const [name, def] of Object.entries(schema.properties)) {
    if (name === "Name" || def.type === "title") continue;
    if (!isStoredScalarPropertyType(def.type)) continue;
    columnDefs.push(
      enrich({
        key: slugifyPropertyKey(name),
        name,
        type: def.type,
      }),
    );
  }
  return columnDefs;
}

export function slugifyPropertyKey(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/[^a-z0-9_]+/g, "_");
  s = s.replace(/^_+|_+$/g, "").replace(/__+/g, "_");
  if (!s) s = "property";
  if (/^\d/.test(s)) s = `prop_${s}`;
  return s;
}

interface NotionViewTableProperty {
  property_id?: string;
  property_name?: string;
  visible?: boolean;
}

function tablePropertiesFromConfiguration(
  configuration: unknown | null,
): NotionViewTableProperty[] {
  if (!configuration || typeof configuration !== "object") return [];
  const props = (configuration as { properties?: unknown }).properties;
  return Array.isArray(props) ? (props as NotionViewTableProperty[]) : [];
}

/** Resolve visible column property ids for a database table view. */
export function visiblePropertyIdsForView(view: NotionViewDefinition): string[] {
  if (view.visiblePropertyIds.length > 0) return [...view.visiblePropertyIds];

  const fromConfig = tablePropertiesFromConfiguration(view.configuration)
    .filter((prop) => prop.visible !== false && prop.property_id)
    .map((prop) => prop.property_id!);

  return fromConfig.length > 0 ? fromConfig : [];
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
