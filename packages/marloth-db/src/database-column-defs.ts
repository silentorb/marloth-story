import type { GraphDatabase } from "./graph";
import type { DatabaseColumnDef } from "./database-view";
import {
  parseNotionSchema,
  slugifyPropertyKey,
  storedScalarColumnDefsFromSchema,
  type NotionDatabaseSchema,
  type NotionPropertyDefinition,
} from "./notion-database-schema";
import { normalizeNotionId } from "./notion-ids";
import { relationType } from "./relation-type";
import {
  coalescePriorityValue,
  enrichColumnDef,
  enrichColumnDefs,
  isPriorityColumnKey,
} from "./property-enums";

export interface BuildDatabaseColumnDefsOptions {
  excludeKeys?: Set<string>;
}

function enrichRelationColumnDef(
  col: DatabaseColumnDef,
  propDef?: NotionPropertyDefinition,
): DatabaseColumnDef {
  if (col.type !== "relation") return col;
  let targetDatabaseId: string | undefined;
  const rawDbId = propDef?.config?.database_id;
  if (typeof rawDbId === "string") {
    const normalized = normalizeNotionId(rawDbId);
    if (normalized) targetDatabaseId = normalized;
  }
  return {
    ...col,
    relationType: relationType(col.name),
    targetDatabaseId,
  };
}

export function mergeDynamicColumnDefs(
  columnDefs: DatabaseColumnDef[],
  dynamicColumnDefs: DatabaseColumnDef[],
  hiddenColumnKeys: Set<string>,
): DatabaseColumnDef[] {
  const dynamicByKey = new Map(dynamicColumnDefs.map((c) => [c.key, c]));
  const merged: DatabaseColumnDef[] = [];

  for (const col of columnDefs) {
    if (hiddenColumnKeys.has(col.key)) continue;
    const dynamic = dynamicByKey.get(col.key);
    if (dynamic) {
      merged.push(dynamic);
      dynamicByKey.delete(col.key);
    } else {
      merged.push(col);
    }
  }

  for (const col of dynamicByKey.values()) {
    merged.push(col);
  }

  return merged;
}

/** Build typed column definitions from notion_schema (all stored scalar columns). */
export function buildDatabaseColumnDefs(
  db: GraphDatabase,
  databaseId: string,
  dynamicColumnDefs: DatabaseColumnDef[],
  hiddenColumnKeys: Set<string>,
  options?: BuildDatabaseColumnDefsOptions,
): DatabaseColumnDef[] {
  const database = db.getNode(databaseId);
  const schema = parseNotionSchema(database?.properties.notion_schema);
  const excludeKeys = options?.excludeKeys ?? new Set<string>();

  const columnDefs: DatabaseColumnDef[] = [];
  if (schema) {
    const scalarDefs = storedScalarColumnDefsFromSchema(schema, (def) =>
      enrichColumnDef(def),
    );
    for (const def of scalarDefs) {
      const key = slugifyPropertyKey(def.name);
      if (excludeKeys.has(key)) continue;
      const propDef = schema.properties[def.name];
      columnDefs.push(
        enrichRelationColumnDef(
          {
            key,
            name: def.name,
            type: def.type,
          },
          propDef,
        ),
      );
    }

    for (const [name, def] of Object.entries(schema.properties)) {
      if (name === "Name" || def.type === "title") continue;
      if (def.type !== "relation") continue;
      const key = slugifyPropertyKey(name);
      if (excludeKeys.has(key)) continue;
      if (columnDefs.some((col) => col.key === key)) continue;
      columnDefs.push(
        enrichRelationColumnDef(
          enrichColumnDef({
            key,
            name,
            type: def.type,
          }),
          def,
        ),
      );
    }
  }

  const merged = mergeDynamicColumnDefs(columnDefs, dynamicColumnDefs, hiddenColumnKeys);
  return enrichColumnDefs(merged.filter((col) => !excludeKeys.has(col.key)));
}

export function normalizeRowCells(
  cells: Record<string, string>,
  columnDefs: DatabaseColumnDef[],
): Record<string, string> {
  if (columnDefs.length === 0) return cells;
  const out: Record<string, string> = {};
  for (const col of columnDefs) {
    const value =
      cells[col.key] ??
      cells[col.name] ??
      Object.entries(cells).find(
        ([k]) => k.toLowerCase() === col.name.toLowerCase(),
      )?.[1];
    if (value !== undefined) {
      out[col.key] = value;
    } else if (isPriorityColumnKey(col.key) || col.enumId === "priority") {
      out[col.key] = coalescePriorityValue(undefined);
    }
  }
  return out;
}

export function parseDatabaseSchema(
  db: GraphDatabase,
  databaseId: string,
): NotionDatabaseSchema | null {
  return parseNotionSchema(db.getNode(databaseId)?.properties.notion_schema);
}
