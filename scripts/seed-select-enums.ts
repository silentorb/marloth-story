#!/usr/bin/env bun
/**
 * Backfill schema.json enums and table-schemas.json enumId for select/status columns
 * that were imported without workspace enum wiring.
 *
 * Usage:
 *   bun scripts/seed-select-enums.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { MEMBER_OF_TYPE } from "../packages/tome-db/src/labels";
import {
  parseTableSchemasFile,
  serializeTableSchemasFile,
  type TableColumnDef,
  type TableScalarColumn,
  type TableSchemasFile,
} from "../packages/tome-db/src/content/table-schemas-file";
import {
  parseRelationshipsFile,
  type RelationshipEntry,
} from "../packages/tome-db/src/content/relationships-file";
import {
  parseSchemaFile,
  serializeSchemaFile,
  type EnumDefinition,
  type SchemaFile,
} from "../packages/tome-db/src/schema-rules/schema-file";
import {
  contentModelDir,
  relationshipsFilePath,
  resolveContentPath,
  tableSchemasFilePath,
  schemaFilePath,
} from "../packages/tome-db/src/content/paths";

const dryRun = process.argv.includes("--dry-run");
const contentRoot = resolveContentPath();

function isScalarSelectColumn(col: TableColumnDef): col is TableScalarColumn {
  return col.type === "select" || col.type === "status";
}

function membershipTypeTableId(entry: RelationshipEntry): string | null {
  if (entry.type !== MEMBER_OF_TYPE || entry.archived) return null;
  const from = entry.directedFrom;
  if (!from) return null;
  if (from === entry.a) return entry.b;
  if (from === entry.b) return entry.a;
  return null;
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function collectColumnValues(
  relationships: RelationshipEntry[],
  tableId: string,
  columnKey: string,
): string[] {
  const values = new Set<string>();
  for (const entry of relationships) {
    const typeTableId = membershipTypeTableId(entry);
    if (typeTableId !== tableId) continue;
    const text = stringProperty(entry.properties?.[columnKey]);
    if (text !== null) values.add(text);
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function optionsFingerprint(options: readonly string[]): string {
  return options.join("\0");
}

function findEnumIdByOptions(
  enums: Record<string, EnumDefinition>,
  options: string[],
): string | null {
  const fingerprint = optionsFingerprint(options);
  for (const [id, def] of Object.entries(enums)) {
    if (optionsFingerprint(def.options) === fingerprint) return id;
  }
  return null;
}

function isYesNoOptions(options: string[]): boolean {
  return options.length === 2 && options.includes("True") && options.includes("False");
}

function proposeEnumId(
  tableId: string,
  columnKey: string,
  options: string[],
  enums: Record<string, EnumDefinition>,
): string {
  const byOptions = findEnumIdByOptions(enums, options);
  if (byOptions) return byOptions;

  if (isYesNoOptions(options)) return "yes_no";

  const byKey = enums[columnKey];
  if (byKey && optionsFingerprint(byKey.options) === optionsFingerprint(options)) {
    return columnKey;
  }
  if (byKey) {
    return `${tableId.slice(0, 8)}_${columnKey}`;
  }
  return columnKey;
}

function pickDefault(options: string[]): string {
  if (options.includes("False")) return "False";
  if (options.includes("Low")) return "Low";
  return options[0]!;
}

function ensureEnum(
  enums: Record<string, EnumDefinition>,
  enumId: string,
  options: string[],
): void {
  const existing = enums[enumId];
  if (existing) {
    if (optionsFingerprint(existing.options) !== optionsFingerprint(options)) {
      throw new Error(
        `Enum "${enumId}" already exists with different options: ${existing.options.join(", ")} vs ${options.join(", ")}`,
      );
    }
    return;
  }
  enums[enumId] = {
    options,
    default: pickDefault(options),
    defaultOrder: "asc",
  };
}

function main(): void {
  const relationships = parseRelationshipsFile(
    readFileSync(relationshipsFilePath(contentRoot), "utf-8"),
  ).relationships;
  const tableSchemas = parseTableSchemasFile(
    readFileSync(tableSchemasFilePath(contentRoot), "utf-8"),
  );
  const schema = parseSchemaFile(readFileSync(schemaFilePath(contentRoot), "utf-8"));

  const nextEnums: Record<string, EnumDefinition> = { ...schema.enums };
  const nextTables: TableSchemasFile["tables"] = JSON.parse(JSON.stringify(tableSchemas.tables));

  const summary: string[] = [];

  for (const [tableId, table] of Object.entries(tableSchemas.tables)) {
    const columns = nextTables[tableId]!.columns;
    for (let index = 0; index < columns.length; index += 1) {
      const col = columns[index]!;
      if (!isScalarSelectColumn(col)) continue;
      if (col.enumId) continue;

      const options = collectColumnValues(relationships, tableId, col.key);
      if (options.length === 0) {
        summary.push(`SKIP ${tableId}.${col.key}: no stored values`);
        continue;
      }

      const enumId = proposeEnumId(tableId, col.key, options, nextEnums);
      ensureEnum(nextEnums, enumId, options);
      const nextCol: TableScalarColumn = { ...col, enumId };
      columns[index] = nextCol;
      summary.push(`WIRE ${tableId}.${col.key} → enumId:${enumId} [${options.join(", ")}]`);
    }
  }

  const nextSchema: SchemaFile = { ...schema, enums: nextEnums };
  const nextTableSchemas: TableSchemasFile = { ...tableSchemas, tables: nextTables };

  if (dryRun) {
    console.log("[dry-run] Would update schema.json and table-schemas.json:\n");
    for (const line of summary) console.log(`  ${line}`);
    return;
  }

  writeFileSync(schemaFilePath(contentRoot), serializeSchemaFile(nextSchema), "utf-8");
  writeFileSync(
    tableSchemasFilePath(contentRoot),
    serializeTableSchemasFile(nextTableSchemas),
    "utf-8",
  );

  console.log(`Updated ${schemaFilePath(contentRoot)} and ${tableSchemasFilePath(contentRoot)}:\n`);
  for (const line of summary) console.log(`  ${line}`);
}

main();
