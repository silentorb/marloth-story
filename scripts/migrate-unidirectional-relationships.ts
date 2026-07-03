#!/usr/bin/env bun
/**
 * Migrate all remaining unidirectional relationship records to bidirectional
 * composites (includes or named dual-perspective types), strip directedFrom
 * from all entries, and remove single-perspective type definitions from
 * relationship-types.json.
 *
 * Resolution rules:
 *  1. scenes, scenes_2, themes, theme, motivation, bible_passages → includes
 *  2. monsters, pacing, story_scale, prop_type, traversal_types, traversal_reasons → *_inspirations
 *  3. parents, children → parents_children
 *
 * Usage: bun scripts/migrate-unidirectional-relationships.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INCLUDES_TYPE,
  TAXONOMY_INSPIRATION_PERSPECTIVES,
} from "../../tome/packages/tome-db/src/includes-relationship";
import { normalizeRelationshipType } from "../../tome/packages/tome-db/src/relation-type";
import {
  relationshipsFilePath,
  relationshipTypesFilePath,
  resolveContentPath,
} from "../../tome/packages/tome-db/src/content/paths";
import {
  compositeTypeForPerspectives,
  isDualPerspectiveType,
  parseRelationshipTypesFile,
  serializeRelationshipTypesFile,
  type RelationshipTypesFile,
} from "../../tome/packages/tome-db/src/content/relationship-types-file";
import {
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  serializeRelationshipsFile,
  sortEndpoints,
} from "../../tome/packages/tome-db/src/content/relationships-file";

const contentRoot = resolveContentPath(resolve(import.meta.dir, ".."));
const dryRun = process.argv.includes("--dry-run");

const INCLUDES_SLUGS = new Set([
  "scenes",
  "scenes_2",
  "themes",
  "theme",
  "motivation",
  "bible_passages",
]);

function mergeProperties(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const score = (p: Record<string, unknown>) =>
    (p.ordinal !== undefined ? 2 : 0) + Object.keys(p).length;
  return score(a) >= score(b) ? { ...b, ...a } : { ...a, ...b };
}

function resolveNewType(
  oldType: string,
  registry: RelationshipTypesFile,
): string | null {
  const normalized = normalizeRelationshipType(oldType);
  const typeDef = registry.types[normalized];

  if (!typeDef) return null;
  if (isDualPerspectiveType(typeDef)) return null;

  const perspective = typeDef.perspectives[0] ?? normalized;

  if (INCLUDES_SLUGS.has(perspective)) {
    return INCLUDES_TYPE;
  }

  if (TAXONOMY_INSPIRATION_PERSPECTIVES.has(perspective)) {
    return compositeTypeForPerspectives(perspective, "inspirations");
  }

  if (perspective === "parents" || perspective === "children") {
    return "parents_children";
  }

  return null;
}

function main(): void {
  const relPath = relationshipsFilePath(contentRoot);
  const typesPath = relationshipTypesFilePath(contentRoot);
  const relFile = JSON.parse(readFileSync(relPath, "utf-8")) as {
    version: number;
    relationships: RelationshipEntry[];
  };
  const registry = parseRelationshipTypesFile(readFileSync(typesPath, "utf-8"));

  const countsByMigration = new Map<string, number>();
  let directedFromStripped = 0;
  let duplicatesMerged = 0;

  const byPair = new Map<string, RelationshipEntry>();

  for (const entry of relFile.relationships) {
    const newType = resolveNewType(entry.type, registry);

    if (newType !== null) {
      const key = `${entry.type} → ${newType}`;
      countsByMigration.set(key, (countsByMigration.get(key) ?? 0) + 1);

      const { a, b } = sortEndpoints(entry.a, entry.b);
      const pairKey = `${a}:${b}:${newType}`;
      const migrated: RelationshipEntry = {
        a,
        b,
        type: newType,
        ...(entry.archived ? { archived: true } : {}),
        ...(entry.properties && Object.keys(entry.properties).length > 0
          ? { properties: entry.properties }
          : {}),
      };

      const existing = byPair.get(pairKey);
      if (existing) {
        existing.properties = mergeProperties(
          existing.properties ?? {},
          migrated.properties ?? {},
        );
        duplicatesMerged++;
      } else {
        byPair.set(pairKey, migrated);
      }
    } else {
      const { a, b } = sortEndpoints(entry.a, entry.b);
      const pairKey = `${a}:${b}:${entry.type}`;
      const cleaned: RelationshipEntry = {
        a,
        b,
        type: entry.type,
        ...(entry.archived ? { archived: true } : {}),
        ...(entry.properties && Object.keys(entry.properties).length > 0
          ? { properties: entry.properties }
          : {}),
      };
      if (entry.directedFrom) directedFromStripped++;

      const existing = byPair.get(pairKey);
      if (existing) {
        existing.properties = mergeProperties(
          existing.properties ?? {},
          cleaned.properties ?? {},
        );
        duplicatesMerged++;
      } else {
        byPair.set(pairKey, cleaned);
      }
    }
  }

  const relationships = [...byPair.values()].sort(
    (x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.type.localeCompare(y.type),
  );

  const prunedRegistry: RelationshipTypesFile = {
    version: registry.version,
    types: {},
  };
  let typesRemoved = 0;
  for (const [name, def] of Object.entries(registry.types)) {
    if (isDualPerspectiveType(def)) {
      prunedRegistry.types[name] = def;
    } else {
      typesRemoved++;
    }
  }

  console.log("migrate-unidirectional-relationships");
  console.log(`  dry run: ${dryRun}`);
  for (const [key, count] of [...countsByMigration.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count}`);
  }
  console.log(`  directedFrom stripped (non-migrated): ${directedFromStripped}`);
  console.log(`  duplicates merged: ${duplicatesMerged}`);
  console.log(`  output relationships: ${relationships.length} (was ${relFile.relationships.length})`);
  console.log(`  type definitions removed: ${typesRemoved}`);
  console.log(`  remaining type definitions: ${Object.keys(prunedRegistry.types).length}`);

  const remainingDirectedFrom = relationships.filter((r) => r.directedFrom).length;
  if (remainingDirectedFrom > 0) {
    console.warn(`  WARNING: ${remainingDirectedFrom} entries still have directedFrom`);
  }

  if (!dryRun) {
    writeFileSync(relPath, serializeRelationshipsFile({ version: RELATIONSHIPS_FILE_VERSION, relationships }));
    writeFileSync(typesPath, serializeRelationshipTypesFile(prunedRegistry));
    console.log("\n  Written.");
  }
}

main();
