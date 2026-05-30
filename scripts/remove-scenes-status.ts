/**
 * Remove legacy Status from the Scenes database schema and IS_A membership properties.
 *
 * Usage: bun scripts/remove-scenes-status.ts [--dry-run]
 */
import { resolve } from "node:path";
import { ContentStore } from "../packages/marloth-db/src/content/store";
import { bodyFromNode } from "../packages/marloth-db/src/content/node-file";
import type { NotionDatabaseSchema, NotionDatabaseViews } from "../packages/marloth-db/src/notion-database-schema";
import { visiblePropertyIdsForView } from "../packages/marloth-db/src/notion-database-schema";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";
const REPO_ROOT = resolve(import.meta.dir, "..");
const CONTENT_DIR = process.env.MARLOTH_CONTENT_PATH ?? resolve(REPO_ROOT, "content");

const dryRun = process.argv.includes("--dry-run");
const store = new ContentStore(CONTENT_DIR);

function removeStatusFromSchema(raw: string): { updated: string; changed: boolean } {
  const schema = JSON.parse(raw) as NotionDatabaseSchema;
  if (!schema.properties?.Status) {
    return { updated: raw, changed: false };
  }
  const { Status: _removed, ...rest } = schema.properties;
  return {
    updated: JSON.stringify({ ...schema, properties: rest }),
    changed: true,
  };
}

function removeStatusFromViews(raw: string): { updated: string; changed: boolean } {
  const stored = JSON.parse(raw) as NotionDatabaseViews;
  let changed = false;

  for (const view of stored.views) {
    const config = view.configuration as {
      properties?: { property_id?: string; property_name?: string; visible?: boolean }[];
    } | null;
    if (!config?.properties) continue;

    const before = config.properties.length;
    config.properties = config.properties.filter((prop) => prop.property_name !== "Status");
    if (config.properties.length !== before) changed = true;

    view.visiblePropertyIds = visiblePropertyIdsForView(view).filter((id) => {
      const match = config.properties!.find((p) => p.property_id === id);
      return match?.property_name !== "Status";
    });
  }

  return {
    updated: JSON.stringify(stored),
    changed,
  };
}

const node = store.readNode(SCENES_DB);
if (!node) throw new Error(`Scenes database node not found: ${SCENES_DB}`);

let schemaChanged = false;
let viewsChanged = false;
const nextProperties = { ...node.properties };

const notionSchema = node.properties.notion_schema;
if (typeof notionSchema === "string") {
  const result = removeStatusFromSchema(notionSchema);
  schemaChanged = result.changed;
  if (result.changed) nextProperties.notion_schema = result.updated;
}

const notionViews = node.properties.notion_views;
if (typeof notionViews === "string") {
  const result = removeStatusFromViews(notionViews);
  viewsChanged = result.changed;
  if (result.changed) nextProperties.notion_views = result.updated;
}

const relationshipsFile = store.readRelationshipsFile();
let relationshipUpdates = 0;

for (const entry of relationshipsFile.relationships) {
  if (entry.target !== SCENES_DB || entry.label !== "IS_A") continue;
  const props = entry.properties;
  if (!props || !("status" in props)) continue;
  relationshipUpdates += 1;
  if (!dryRun) {
    const { status: _removed, ...rest } = props;
    entry.properties = Object.keys(rest).length > 0 ? rest : undefined;
  }
}

console.log(
  dryRun
    ? `[dry-run] schema=${schemaChanged} views=${viewsChanged} relationships=${relationshipUpdates}`
    : `Updated schema=${schemaChanged} views=${viewsChanged} relationships=${relationshipUpdates}`,
);

if (!dryRun) {
  if (schemaChanged || viewsChanged) {
    store.writeNode({ id: SCENES_DB, properties: nextProperties }, bodyFromNode(node));
  }
  if (relationshipUpdates > 0) {
    store.writeRelationshipsFile(relationshipsFile);
  }
}
