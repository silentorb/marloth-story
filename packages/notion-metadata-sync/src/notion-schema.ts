import type {
  NotionDatabaseResponse,
  NotionPropertySchemaRaw,
  NotionViewResponse,
} from "./notion-client";

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

export function mapDatabaseSchema(database: NotionDatabaseResponse): NotionDatabaseSchema {
  const properties: Record<string, NotionPropertyDefinition> = {};
  for (const [name, raw] of Object.entries(database.properties ?? {})) {
    properties[name] = mapPropertyDefinition(name, raw);
  }
  return {
    syncedAt: new Date().toISOString(),
    properties,
  };
}

function mapPropertyDefinition(name: string, raw: NotionPropertySchemaRaw): NotionPropertyDefinition {
  const type = raw.type;
  const config: Record<string, unknown> = {};
  const typePayload = raw[type];
  if (typePayload && typeof typePayload === "object") {
    Object.assign(config, typePayload as Record<string, unknown>);
  }
  return {
    id: raw.id,
    name,
    type,
    config,
  };
}

export function mapViewDefinition(view: NotionViewResponse): NotionViewDefinition {
  const visiblePropertyIds: string[] = [];
  const tableProps = view.format?.table_properties;
  if (Array.isArray(tableProps)) {
    for (const prop of tableProps) {
      if (prop.visible !== false && prop.property_id) {
        visiblePropertyIds.push(prop.property_id);
      }
    }
  }

  const sorts = Array.isArray(view.sorts) ? view.sorts : [];
  const configuration =
    view.configuration && typeof view.configuration === "object" ? view.configuration : null;

  return {
    id: view.id.replace(/-/g, ""),
    name: view.name ?? "Untitled",
    type: view.type ?? "table",
    filter: view.filter ?? null,
    sorts,
    visiblePropertyIds,
    configuration,
  };
}

export function parseStoredSchema(raw: unknown): NotionDatabaseSchema | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as NotionDatabaseSchema;
  } catch {
    return null;
  }
}

export function parseStoredViews(raw: unknown): NotionDatabaseViews | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as NotionDatabaseViews;
  } catch {
    return null;
  }
}

export function propertyNameById(
  schema: NotionDatabaseSchema,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, def] of Object.entries(schema.properties)) {
    map.set(def.id, name);
  }
  return map;
}

export function extractPagePropertyValue(
  properties: Record<string, unknown> | undefined,
  propName: string,
  propType: string,
): string | null {
  if (!properties) return null;
  const prop = properties[propName] as Record<string, unknown> | undefined;
  if (!prop) return null;

  switch (propType) {
    case "title": {
      const title = prop.title as { plain_text?: string }[] | undefined;
      return title?.map((t) => t.plain_text ?? "").join("") || null;
    }
    case "rich_text": {
      const rich = prop.rich_text as { plain_text?: string }[] | undefined;
      return rich?.map((t) => t.plain_text ?? "").join("") || null;
    }
    case "number":
      return prop.number !== null && prop.number !== undefined ? String(prop.number) : null;
    case "checkbox":
      return prop.checkbox === true ? "true" : prop.checkbox === false ? "false" : null;
    case "select": {
      const sel = prop.select as { name?: string } | null;
      return sel?.name ?? null;
    }
    case "multi_select": {
      const multi = prop.multi_select as { name?: string }[] | undefined;
      return multi?.map((m) => m.name).filter(Boolean).join(", ") || null;
    }
    case "status": {
      const status = prop.status as { name?: string } | null;
      return status?.name ?? null;
    }
    case "date": {
      const date = prop.date as { start?: string; end?: string } | null;
      if (!date?.start) return null;
      return date.end ? `${date.start} → ${date.end}` : date.start;
    }
    case "url":
      return typeof prop.url === "string" ? prop.url : null;
    case "email":
      return typeof prop.email === "string" ? prop.email : null;
    case "phone_number":
      return typeof prop.phone_number === "string" ? prop.phone_number : null;
    case "formula": {
      const formula = prop.formula as { type?: string; string?: string; number?: number; boolean?: boolean } | undefined;
      if (!formula) return null;
      if (formula.type === "string") return formula.string ?? null;
      if (formula.type === "number") return formula.number !== undefined ? String(formula.number) : null;
      if (formula.type === "boolean") return formula.boolean !== undefined ? String(formula.boolean) : null;
      return null;
    }
    default:
      return null;
  }
}
