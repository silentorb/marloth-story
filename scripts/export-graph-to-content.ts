import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  GraphDatabase,
  loadDynamicColumnSets,
  loadDynamicFields,
} from "marloth-db";
import {
  ContentStore,
  RELATIONSHIPS_FILE_VERSION,
  DYNAMIC_FIELDS_FILE_VERSION,
  entryFromSeedColumnSet,
  entryFromSeedField,
  fileFromSeedInputs,
  bodyFromNode,
} from "marloth-db/content";
import { starterDynamicFieldSeeds } from "./seed-dynamic-fields.ts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const DEFAULT_DB = resolve(REPO_ROOT, "data/marloth.sqlite");
const DEFAULT_CONTENT = resolve(REPO_ROOT, "content");

function dbPath(): string {
  return process.env.MARLOTH_DB_PATH ?? DEFAULT_DB;
}

function contentPath(): string {
  return process.env.MARLOTH_CONTENT_PATH ?? DEFAULT_CONTENT;
}

function exportDynamicFields(db: GraphDatabase, store: ContentStore): void {
  const databaseIds = new Set<string>();
  const fieldRows = db.queryAll<{ database_id: string }>(
    "SELECT DISTINCT database_id FROM dynamic_fields",
  );
  const setRows = db.queryAll<{ database_id: string }>(
    "SELECT DISTINCT database_id FROM dynamic_column_sets",
  );
  for (const row of fieldRows) databaseIds.add(row.database_id);
  for (const row of setRows) databaseIds.add(row.database_id);

  const fields = [];
  const columnSets = [];

  if (databaseIds.size === 0) {
    const starter = starterDynamicFieldSeeds();
    store.writeDynamicFieldsFile(fileFromSeedInputs(starter.fields, starter.columnSets));
    return;
  }
  for (const databaseId of databaseIds) {
    for (const field of loadDynamicFields(db, databaseId)) {
      fields.push(
        entryFromSeedField({
          id: field.id,
          databaseId: field.databaseId,
          columnKey: field.columnKey,
          columnName: field.columnName,
          columnType: field.columnType,
          resolverId: field.resolverId,
          docsPath: field.docsPath,
          params: field.params,
          viewNames: field.viewNames,
        }),
      );
    }
    for (const set of loadDynamicColumnSets(db, databaseId)) {
      columnSets.push(
        entryFromSeedColumnSet({
          id: set.id,
          databaseId: set.databaseId,
          columnKeyPattern: set.columnKeyPattern,
          columnNamePattern: set.columnNamePattern,
          columnType: set.columnType,
          resolverId: set.resolverId,
          docsPath: set.docsPath,
          params: set.params,
          viewNames: set.viewNames,
        }),
      );
    }
  }

  store.writeDynamicFieldsFile({
    version: DYNAMIC_FIELDS_FILE_VERSION,
    fields,
    columnSets,
  });
}

export function exportGraphToContent(
  sourceDbPath: string,
  targetContentDir: string,
  options?: { clean?: boolean },
): { nodes: number; relationships: number } {
  if (options?.clean) {
    try {
      rmSync(targetContentDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  mkdirSync(targetContentDir, { recursive: true });

  const db = new GraphDatabase(sourceDbPath);
  const store = new ContentStore(targetContentDir);

  const nodeRows = db.queryAll<{ id: string }>("SELECT id FROM nodes ORDER BY id");
  for (const row of nodeRows) {
    const node = db.getNode(row.id);
    if (!node) continue;
    const body = bodyFromNode(node);
    const { body: _b, ...properties } = node.properties;
    store.writeNode({ id: node.id, labels: node.labels, properties }, body);
  }

  const relationships = db
    .queryAll<{
      source_node_id: string;
      target_node_id: string;
      label: string;
      properties: string;
    }>("SELECT source_node_id, target_node_id, label, properties FROM relationships ORDER BY id")
    .map((row) => ({
      source: row.source_node_id,
      target: row.target_node_id,
      label: row.label,
      properties: JSON.parse(row.properties) as Record<string, unknown>,
    }));

  store.writeRelationshipsFile({
    version: RELATIONSHIPS_FILE_VERSION,
    relationships,
  });

  exportDynamicFields(db, store);
  db.close();

  return { nodes: nodeRows.length, relationships: relationships.length };
}

if (import.meta.main) {
  const counts = exportGraphToContent(dbPath(), contentPath(), { clean: true });
  console.log(`Exported ${counts.nodes} nodes and ${counts.relationships} relationships to ${contentPath()}`);
}
