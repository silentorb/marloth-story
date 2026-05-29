import type { DatabaseColumnDef } from "./database-view";
import { applyDynamicFields } from "./dynamic-fields";
import type { GraphDatabase } from "./graph";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";
import type { EvalRow } from "./notion-view-eval";
import {
  parseNotionSchema,
  storedScalarColumnDefsFromSchema,
} from "./notion-database-schema";
import {
  coalescePriorityValue,
  enrichColumnDef,
  enrichColumnDefs,
  isPriorityColumnKey,
} from "./property-enums";

const ROW_META_KEYS = new Set(["view", "row_index", "row_name", "order"]);

export interface PropertiesSection {
  type: "properties";
  databaseId: string;
  typeTitle: string;
  columns: string[];
  columnDefs?: DatabaseColumnDef[];
  cells: Record<string, string>;
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return "Untitled";
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cellsFromConnectionProperties(properties: Record<string, unknown>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (ROW_META_KEYS.has(key)) continue;
    const text = stringProperty(value);
    if (text !== null) cells[key] = text;
  }
  return cells;
}

function legacyColumnLabel(key: string): string {
  if (isPriorityColumnKey(key)) return "Priority";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePropertyCells(
  cells: Record<string, string>,
  columnDefs: DatabaseColumnDef[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columnDefs) {
    const value =
      cells[col.key] ??
      cells[col.name] ??
      Object.entries(cells).find(([k]) => k.toLowerCase() === col.name.toLowerCase())?.[1];
    if (value !== undefined) {
      out[col.key] = value;
    } else if (isPriorityColumnKey(col.key) || col.enumId === "priority") {
      out[col.key] = coalescePriorityValue(undefined);
    } else if (col.source === "dynamic") {
      out[col.key] = cells[col.key] ?? "";
    }
  }
  return out;
}

function mergeStoredAndDynamicColumnDefs(
  storedColumnDefs: DatabaseColumnDef[],
  dynamicColumnDefs: DatabaseColumnDef[],
  hiddenColumnKeys: Set<string>,
): DatabaseColumnDef[] {
  const dynamicByKey = new Map(dynamicColumnDefs.map((col) => [col.key, col]));
  const merged: DatabaseColumnDef[] = [];

  for (const col of storedColumnDefs) {
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

/** Build typed-node Properties from IS_A membership scalars and dynamic fields. */
export function buildPropertiesSection(
  db: GraphDatabase,
  nodeId: string,
): PropertiesSection | null {
  // v1: first type membership connection when a node belongs to multiple types.
  let membershipConnection = null as ReturnType<GraphDatabase["listConnectionsFromSource"]>[number] | null;
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const connections = db.listConnectionsFromSource(nodeId, label);
    if (connections.length > 0) {
      membershipConnection = connections[0]!;
      break;
    }
  }
  if (!membershipConnection) return null;

  const databaseId = membershipConnection.targetNodeId;
  const database = db.getNode(databaseId);
  if (!database?.labels.includes("NotionDatabase")) return null;

  const typeTitle = titleFromProperties(database.properties);
  const schema = parseNotionSchema(database.properties.notion_schema);
  const storedCells = cellsFromConnectionProperties(membershipConnection.properties);

  let storedColumnDefs: DatabaseColumnDef[];
  if (schema) {
    storedColumnDefs = enrichColumnDefs(
      storedScalarColumnDefsFromSchema(schema, (def) => enrichColumnDef(def)),
    );
  } else {
    const keys = Object.keys(storedCells).sort((a, b) => a.localeCompare(b));
    storedColumnDefs = enrichColumnDefs(
      keys.map((key) =>
        enrichColumnDef({
          key,
          name: legacyColumnLabel(key),
          type: "text",
        }),
      ),
    );
  }

  const node = db.getNode(nodeId);
  const evalRow: EvalRow = {
    nodeId,
    name: node ? titleFromProperties(node.properties) : "Untitled",
    cells: storedCells,
    rowIndex: 0,
    createdAt: null,
    modifiedAt: null,
  };

  const { rows, dynamicColumnDefs, hiddenColumnKeys } = applyDynamicFields(
    db,
    databaseId,
    "",
    [evalRow],
    undefined,
    { allViews: true },
  );

  const mergedColumnDefs = mergeStoredAndDynamicColumnDefs(
    storedColumnDefs,
    dynamicColumnDefs,
    hiddenColumnKeys,
  );
  if (mergedColumnDefs.length === 0) return null;

  const enrichedCells = { ...storedCells, ...rows[0]!.cells };
  const cells = normalizePropertyCells(enrichedCells, mergedColumnDefs);
  const columns = mergedColumnDefs.map((col) => col.key);

  return {
    type: "properties",
    databaseId,
    typeTitle,
    columns,
    columnDefs: mergedColumnDefs,
    cells,
  };
}
