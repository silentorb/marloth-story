#!/usr/bin/env bun
/**
 * Migrate associative relationship types to symmetric `includes` records.
 *
 * Usage: bun scripts/migrate-to-includes.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MIGRATE_TO_INCLUDES_STORAGE_TYPES,
  INCLUDES_TYPE,
} from "../packages/tome-db/src/includes-relationship";
import {
  relationshipsFilePath,
  relationshipTypesFilePath,
  resolveContentPath,
} from "../packages/tome-db/src/content/paths";
import {
  emptyRelationshipTypesFile,
  registerIncludesType,
  serializeRelationshipTypesFile,
} from "../packages/tome-db/src/content/relationship-types-file";
import {
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  serializeRelationshipsFile,
  sortEndpoints,
} from "../packages/tome-db/src/content/relationships-file";
import { normalizeRelationshipType } from "../packages/tome-db/src/relation-type";

const contentRoot = resolveContentPath(resolve(import.meta.dir, ".."));
const dryRun = process.argv.includes("--dry-run");

function mergeProperties(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const score = (p: Record<string, unknown>) =>
    (p.ordinal !== undefined ? 2 : 0) + Object.keys(p).length;
  return score(a) >= score(b) ? { ...b, ...a } : { ...a, ...b };
}

function main(): void {
  const relPath = relationshipsFilePath(contentRoot);
  const typesPath = relationshipTypesFilePath(contentRoot);
  const relFile = JSON.parse(readFileSync(relPath, "utf-8")) as {
    version: number;
    relationships: RelationshipEntry[];
  };
  const typesFile = JSON.parse(readFileSync(typesPath, "utf-8")) as {
    version: number;
    types: Record<string, { bidirectional: boolean; perspectives: string[] }>;
  };

  const migrateTypes = MIGRATE_TO_INCLUDES_STORAGE_TYPES;
  const countsByOldType = new Map<string, number>();
  let duplicatesMerged = 0;

  const byPair = new Map<string, RelationshipEntry>();

  for (const entry of relFile.relationships) {
    const normalizedType = normalizeRelationshipType(entry.type);
    if (!migrateTypes.has(normalizedType)) {
      const key = `${entry.a}:${entry.b}:${entry.type}`;
      if (byPair.has(key)) {
        console.warn(`unexpected duplicate non-migrating record: ${key}`);
      }
      byPair.set(key, entry);
      continue;
    }

    countsByOldType.set(normalizedType, (countsByOldType.get(normalizedType) ?? 0) + 1);
    const { a, b } = sortEndpoints(entry.a, entry.b);
    const includesKey = `${a}:${b}:${INCLUDES_TYPE}`;
    const properties = { ...(entry.properties ?? {}) };
    const { directedFrom: _drop, ...rest } = entry;
    const migrated: RelationshipEntry = { ...rest, a, b, type: INCLUDES_TYPE, properties };

    const existing = byPair.get(includesKey);
    if (existing) {
      existing.properties = mergeProperties(
        existing.properties ?? {},
        migrated.properties ?? {},
      );
      duplicatesMerged++;
    } else {
      byPair.set(includesKey, migrated);
    }
  }

  const relationships = [...byPair.values()].sort(
    (x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.type.localeCompare(y.type),
  );

  const registry = emptyRelationshipTypesFile();
  for (const [typeName, def] of Object.entries(typesFile.types)) {
    if (migrateTypes.has(normalizeRelationshipType(typeName))) continue;
    registry.types[typeName] = def;
  }
  registerIncludesType(registry);

  console.log("migrate-to-includes");
  console.log(`  dry run: ${dryRun}`);
  for (const [type, count] of [...countsByOldType.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`  duplicates merged: ${duplicatesMerged}`);
  console.log(`  output relationships: ${relationships.length}`);
  console.log(`  registry types: ${Object.keys(registry.types).length}`);

  const includesCount = relationships.filter((e) => e.type === INCLUDES_TYPE).length;
  const withDirectedFrom = relationships.filter(
    (e) => e.type === INCLUDES_TYPE && e.directedFrom,
  ).length;
  console.log(`  includes records: ${includesCount}`);
  if (withDirectedFrom > 0) {
    console.warn(`  WARNING: ${withDirectedFrom} includes rows still have directedFrom`);
  }

  if (dryRun) return;

  writeFileSync(
    relPath,
    serializeRelationshipsFile({ version: RELATIONSHIPS_FILE_VERSION, relationships }),
  );
  writeFileSync(typesPath, serializeRelationshipTypesFile(registry));
  console.log("done");
}

main();
