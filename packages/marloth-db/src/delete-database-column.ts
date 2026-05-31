import { listRelationConnectionsForRow } from "./database-view-relations";
import { loadDynamicFields } from "./dynamic-fields";
import { TYPE_MEMBERSHIP_TYPES } from "./labels";
import { isTypeTableNode } from "./node-capabilities";
import { normalizeNotionId } from "./notion-ids";
import {
  parseNotionSchema,
  slugifyPropertyKey,
  type NotionDatabaseSchema,
} from "./notion-database-schema";
import { unlinkOutgoingRelationship } from "./relationship-link-mutations";
import { otherEndpoint } from "./relationship-traverse";
import { relationType } from "./relation-type";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterNodeWrite, syncAfterRelationshipsWrite } from "./content/write-context";
import { ITEMS_SECTION_KEY } from "./views/resolve-tabs";
import { purgeColumnFromViews } from "./views/mutations";

const ROW_META_KEYS = new Set(["view", "row_index", "row_name", "order"]);

export type DeleteDatabaseColumnError =
  | "database_not_found"
  | "column_not_found"
  | "column_not_deletable";

export interface DeleteDatabaseColumnResult {
  rowsAffected: number;
  relationsUnlinked: number;
}

function findSchemaPropertyName(schema: NotionDatabaseSchema, columnKey: string): string | null {
  for (const [name, def] of Object.entries(schema.properties)) {
    if (name === "Name" || def.type === "title") continue;
    if (slugifyPropertyKey(name) === columnKey) return name;
  }
  return null;
}

function stripScalarFromMembershipEdges(
  ctx: MarlothWriteContext,
  databaseId: string,
  propertyKey: string,
): number {
  let count = 0;
  for (const type of TYPE_MEMBERSHIP_TYPES) {
    for (const connection of ctx.db.listRelationshipsToTarget(databaseId, type)) {
      if (!(propertyKey in connection.properties)) continue;
      const props = { ...connection.properties };
      delete props[propertyKey];
      ctx.store.replaceRelationshipProperties(
        connection.sourceNodeId,
        connection.targetNodeId,
        type,
        props,
      );
      count++;
    }
  }
  return count;
}

function unlinkRelationColumnFromAllRows(
  ctx: MarlothWriteContext,
  databaseId: string,
  propertyName: string,
  schema: NotionDatabaseSchema,
): number {
  const propDef = schema.properties[propertyName];
  if (!propDef || propDef.type !== "relation") return 0;

  const connectionType = relationType(propertyName);
  let targetDatabaseId: string | undefined;
  const rawDbId = propDef.config?.database_id;
  if (typeof rawDbId === "string") {
    const normalized = normalizeNotionId(rawDbId);
    if (normalized) targetDatabaseId = normalized;
  }

  const rowIds = new Set<string>();
  for (const type of TYPE_MEMBERSHIP_TYPES) {
    for (const connection of ctx.db.listRelationshipsToTarget(databaseId, type)) {
      rowIds.add(connection.sourceNodeId);
    }
  }

  const toUnlink: Array<{ rowId: string; targetId: string }> = [];
  for (const rowId of rowIds) {
    const relationships = listRelationConnectionsForRow(
      ctx.db,
      rowId,
      connectionType,
      databaseId,
      targetDatabaseId,
    );
    for (const relationship of relationships) {
      toUnlink.push({ rowId, targetId: otherEndpoint(relationship, rowId) });
    }
  }

  let unlinked = 0;
  for (const { rowId, targetId } of toUnlink) {
    if (unlinkOutgoingRelationship(ctx, rowId, targetId, connectionType) === null) {
      unlinked++;
    }
  }
  return unlinked;
}

export function deleteDatabaseColumn(
  ctx: MarlothWriteContext,
  databaseId: string,
  columnKey: string,
): DeleteDatabaseColumnError | DeleteDatabaseColumnResult {
  const normalizedKey = columnKey.trim();
  if (!normalizedKey || normalizedKey === "name" || ROW_META_KEYS.has(normalizedKey)) {
    return "column_not_deletable";
  }

  if (!isTypeTableNode(ctx.db, databaseId)) {
    return "database_not_found";
  }

  const dynamicFields = loadDynamicFields(ctx.db, databaseId, ctx.store.contentDir);
  if (dynamicFields.some((field) => field.enabled && field.columnKey === normalizedKey)) {
    return "column_not_deletable";
  }

  const database = ctx.db.getNode(databaseId);
  const schema = parseNotionSchema(database?.properties.notion_schema);
  if (!schema) {
    return "column_not_found";
  }

  const propertyName = findSchemaPropertyName(schema, normalizedKey);
  if (!propertyName) {
    return "column_not_found";
  }

  const propDef = schema.properties[propertyName]!;
  let rowsAffected = 0;
  let relationsUnlinked = 0;

  if (propDef.type === "relation") {
    relationsUnlinked = unlinkRelationColumnFromAllRows(ctx, databaseId, propertyName, schema);
  } else {
    rowsAffected = stripScalarFromMembershipEdges(ctx, databaseId, normalizedKey);
  }

  delete schema.properties[propertyName];
  ctx.store.mergeNodeProperties(databaseId, {
    notion_schema: JSON.stringify(schema),
  });
  purgeColumnFromViews(ctx.store, databaseId, ITEMS_SECTION_KEY, normalizedKey);

  syncAfterRelationshipsWrite(ctx);
  syncAfterNodeWrite(ctx, databaseId);
  ctx.sync.syncAfterWrite("views.json");

  return { rowsAffected, relationsUnlinked };
}
