/**
 * Remove legacy Reference from the Inspirations database schema and IS_A membership properties.
 *
 * Usage: bun scripts/remove-inspirations-reference.ts [--dry-run]
 */
import { resolve } from "node:path";
import { ContentStore } from "../packages/marloth-db/src/content/store";
import { bodyFromNode } from "../packages/marloth-db/src/content/node-file";
import type { NotionDatabaseSchema } from "../packages/marloth-db/src/notion-database-schema";

const INSPIRATIONS_DB = "2eea538996934ce8abafc27132e576c1";
const REPO_ROOT = resolve(import.meta.dir, "..");
const CONTENT_DIR = process.env.MARLOTH_CONTENT_PATH ?? resolve(REPO_ROOT, "content");

const dryRun = process.argv.includes("--dry-run");
const store = new ContentStore(CONTENT_DIR);

function removeReferenceFromSchema(raw: string): { updated: string; changed: boolean } {
  const schema = JSON.parse(raw) as NotionDatabaseSchema;
  if (!schema.properties?.Reference) {
    return { updated: raw, changed: false };
  }
  const { Reference: _removed, ...rest } = schema.properties;
  return {
    updated: JSON.stringify({ ...schema, properties: rest }),
    changed: true,
  };
}

const node = store.readNode(INSPIRATIONS_DB);
if (!node) throw new Error(`Inspirations database node not found: ${INSPIRATIONS_DB}`);

let schemaChanged = false;
const nextProperties = { ...node.properties };

const notionSchema = node.properties.notion_schema;
if (typeof notionSchema === "string") {
  const result = removeReferenceFromSchema(notionSchema);
  schemaChanged = result.changed;
  if (result.changed) nextProperties.notion_schema = result.updated;
}

const relationshipsFile = store.readRelationshipsFile();
let relationshipUpdates = 0;

for (const entry of relationshipsFile.relationships) {
  if (entry.type !== "is_a") continue;
  if (entry.a !== INSPIRATIONS_DB && entry.b !== INSPIRATIONS_DB) continue;
  const props = entry.properties;
  if (!props || !("reference" in props)) continue;
  relationshipUpdates += 1;
  if (!dryRun) {
    const { reference: _removed, ...rest } = props;
    entry.properties = Object.keys(rest).length > 0 ? rest : undefined;
  }
}

console.log(
  dryRun
    ? `[dry-run] schema=${schemaChanged} relationships=${relationshipUpdates}`
    : `Updated schema=${schemaChanged} relationships=${relationshipUpdates}`,
);

if (!dryRun) {
  if (schemaChanged) {
    store.writeNode({ id: INSPIRATIONS_DB, properties: nextProperties }, bodyFromNode(node));
  }
  if (relationshipUpdates > 0) {
    store.writeRelationshipsFile(relationshipsFile);
  }
}
