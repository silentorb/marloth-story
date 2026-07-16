import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  GraphDatabase,
  loadDynamicColumnSets,
  loadDynamicProperties,
} from "tome-db";
import {
  ContentStore,
  RELATIONSHIPS_FILE_VERSION,
  DYNAMIC_PROPERTIES_FILE_VERSION,
  entryFromSeedColumnSet,
  entryFromSeedProperty,
  fileFromSeedInputs,
  bodyFromNode,
} from "tome-db/content";
import { starterDynamicPropertySeeds } from "./seed-dynamic-properties.ts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const DEFAULT_DB = resolve(REPO_ROOT, "data/marloth.sqlite");
const DEFAULT_CONTENT = resolve(REPO_ROOT, "content");

function dbPath(): string {
  return process.env.MARLOTH_DB_PATH ?? DEFAULT_DB;
}

function contentPath(): string {
  return process.env.MARLOTH_CONTENT_PATH ?? DEFAULT_CONTENT;
}

function exportDynamicProperties(db: GraphDatabase, store: ContentStore): void {
  const owners = new Set<string>();
  const propertyRows = db.queryAll<{ database_id: string }>(
    "SELECT DISTINCT database_id FROM dynamic_fields",
  );
  const setRows = db.queryAll<{ database_id: string }>(
    "SELECT DISTINCT database_id FROM dynamic_column_sets",
  );
  for (const row of propertyRows) owners.add(row.database_id);
  for (const row of setRows) owners.add(row.database_id);

  const properties = [];
  const columnSets = [];

  if (owners.size === 0) {
    const starter = starterDynamicPropertySeeds();
    store.writeDynamicPropertiesFile(fileFromSeedInputs(starter.properties, starter.columnSets));
    return;
  }
  for (const owner of owners) {
    for (const property of loadDynamicProperties(db, owner)) {
      properties.push(
        entryFromSeedProperty({
          id: property.id,
          owner: property.owner,
          columnKey: property.columnKey,
          columnName: property.columnName,
          columnType: property.columnType,
          resolverId: property.resolverId,
          params: property.params,
        }),
      );
    }
    for (const set of loadDynamicColumnSets(db, owner)) {
      columnSets.push(
        entryFromSeedColumnSet({
          id: set.id,
          owner: set.owner,
          columnKeyPattern: set.columnKeyPattern,
          columnNamePattern: set.columnNamePattern,
          columnType: set.columnType,
          resolverId: set.resolverId,
          params: set.params,
        }),
      );
    }
  }

  store.writeDynamicPropertiesFile({
    version: DYNAMIC_PROPERTIES_FILE_VERSION,
    properties,
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
    store.writeNode({ id: node.id, properties }, body);
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

  exportDynamicProperties(db, store);
  db.close();

  return { nodes: nodeRows.length, relationships: relationships.length };
}

if (import.meta.main) {
  const counts = exportGraphToContent(dbPath(), contentPath(), { clean: true });
  console.log(`Exported ${counts.nodes} nodes and ${counts.relationships} relationships to ${contentPath()}`);
}
