#!/usr/bin/env bun
/**
 * One-time migration: notion_schema frontmatter → content/model/table-schemas.json;
 * strip notion_schema from type-table node frontmatter.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  emptyTableSchemasFile,
  serializeTableSchemasFile,
  type TableColumnDef,
  type TableSchemasFile,
} from "../packages/marloth-db/src/content/table-schemas-file";
import { parseNodeFile, serializeNodeFile } from "../packages/marloth-db/src/content/node-file";
import { parseNotionSchema, slugifyPropertyKey } from "../packages/marloth-db/src/notion-database-schema";
import { isStoredScalarColumnType } from "../packages/marloth-db/src/table-schema";
import type { TableColumnScalarType } from "../packages/marloth-db/src/content/table-schemas-file";
import { relationType } from "../packages/marloth-db/src/relation-type";
import { normalizeNotionId } from "../packages/marloth-db/src/notion-ids";
import { contentDataDir, contentModelDir, resolveContentPath } from "../packages/marloth-db/src/content/paths";
import { loadSchemaFromContent } from "../packages/marloth-db/src/schema-rules/load";

const dryRun = process.argv.includes("--dry-run");
const contentRoot = resolveContentPath();

function enumIdForColumn(key: string): string | undefined {
  const schema = loadSchemaFromContent(contentRoot);
  if (schema.enums[key]) return key;
  if (key === "priority" && schema.enums.priority) return "priority";
  return undefined;
}

function normalizeNotionSchemaRaw(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    let value: unknown = raw;
    for (let depth = 0; depth < 3; depth += 1) {
      if (typeof value !== "string") break;
      try {
        value = JSON.parse(value);
      } catch {
        break;
      }
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return raw;
  }
  if (raw && typeof raw === "object") {
    return JSON.stringify(raw);
  }
  return null;
}

function migrateTable(nodeId: string, notionSchemaRaw: unknown): TableColumnDef[] {
  const normalized = normalizeNotionSchemaRaw(notionSchemaRaw);
  const legacy = normalized ? parseNotionSchema(normalized) : null;
  if (!legacy?.properties || typeof legacy.properties !== "object") {
    throw new Error(`Invalid notion_schema on node ${nodeId}`);
  }

  const columns: TableColumnDef[] = [];
  const usedKeys = new Set<string>();
  for (const [name, def] of Object.entries(legacy.properties)) {
    if (name === "Name" || def.type === "title") continue;

    let key = slugifyPropertyKey(name);
    if (usedKeys.has(key)) {
      let suffix = 2;
      while (usedKeys.has(`${key}_${suffix}`)) suffix += 1;
      const nextKey = `${key}_${suffix}`;
      console.warn(`  duplicate column key "${key}" for "${name}" → "${nextKey}"`);
      key = nextKey;
    }
    usedKeys.add(key);

    if (def.type === "relation") {
      const rawDbId = def.config?.database_id;
      if (typeof rawDbId !== "string") {
        throw new Error(`${nodeId}: relation "${name}" missing database_id`);
      }
      const targetTypeId = normalizeNotionId(rawDbId);
      if (!targetTypeId) {
        throw new Error(`${nodeId}: relation "${name}" has unmapped database_id ${rawDbId}`);
      }
      columns.push({
        key,
        name,
        type: "relation",
        targetTypeId,
        perspective: relationType(name),
      });
      continue;
    }

    if (!isStoredScalarColumnType(def.type)) {
      console.warn(`  drop non-stored column: ${name} (${def.type})`);
      continue;
    }

    const enumId = def.type === "select" || def.type === "status" ? enumIdForColumn(key) : undefined;
    columns.push({
      key,
      name,
      type: def.type as TableColumnScalarType,
      ...(enumId ? { enumId } : {}),
    });
  }

  return columns;
}

function stripNotionSchemaFromFrontmatter(nodeId: string, filePath: string): boolean {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseNodeFile(nodeId, raw);
  if (!("notion_schema" in parsed.properties)) return false;

  const { notion_schema: _removed, ...rest } = parsed.properties;
  const next = serializeNodeFile({ id: parsed.id, properties: rest }, parsed.body);
  if (!dryRun) writeFileSync(filePath, next, "utf-8");
  return true;
}

const dataDir = contentDataDir(contentRoot);
const schemasFile: TableSchemasFile = emptyTableSchemasFile();
let migratedTables = 0;
let strippedNodes = 0;

for (const file of readdirSync(dataDir)) {
  if (!file.endsWith(".md")) continue;
  const nodeId = file.slice(0, 32);
  const raw = readFileSync(resolve(dataDir, file), "utf-8");
  const parsed = parseNodeFile(nodeId, raw);
  const notionSchemaRaw = parsed.properties.notion_schema;
  if (notionSchemaRaw === undefined || notionSchemaRaw === null) continue;

  const columns = migrateTable(nodeId, notionSchemaRaw);
  schemasFile.tables[nodeId] = { columns };
  migratedTables += 1;
  console.log(`Migrated table schema: ${nodeId} (${columns.length} columns)`);

  if (stripNotionSchemaFromFrontmatter(nodeId, resolve(dataDir, file))) {
    strippedNodes += 1;
  }
}

const outPath = resolve(contentModelDir(contentRoot), "table-schemas.json");
if (!dryRun) {
  writeFileSync(outPath, serializeTableSchemasFile(schemasFile), "utf-8");
}

console.log(
  dryRun
    ? `[dry-run] would write ${migratedTables} tables to table-schemas.json; strip notion_schema from ${strippedNodes} nodes`
    : `Wrote ${migratedTables} tables to table-schemas.json; stripped notion_schema from ${strippedNodes} nodes`,
);
