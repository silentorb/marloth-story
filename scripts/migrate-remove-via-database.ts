#!/usr/bin/env bun
/**
 * Remove legacy via_database relationship properties; scoping uses row member_of membership.
 *
 * Usage:
 *   bun scripts/migrate-remove-via-database.ts --audit
 *   bun scripts/migrate-remove-via-database.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  relationshipsFilePath,
  resolveContentPath,
} from "../packages/tome-db/src/content/paths";
import {
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  serializeRelationshipsFile,
} from "../packages/tome-db/src/content/relationships-file";
import { MEMBER_OF_TYPE } from "../packages/tome-db/src/labels";

const contentRoot = resolveContentPath(resolve(import.meta.dir, ".."));
const relPath = relationshipsFilePath(contentRoot);
const auditOnly = process.argv.includes("--audit");
const dryRun = process.argv.includes("--dry-run");

const relFile = JSON.parse(readFileSync(relPath, "utf-8")) as {
  version: number;
  relationships: RelationshipEntry[];
};

function isATargetsByNode(): Map<string, Set<string>> {
  const byNode = new Map<string, Set<string>>();
  for (const entry of relFile.relationships) {
    if (entry.type !== MEMBER_OF_TYPE) continue;
    const source = entry.directedFrom ?? entry.a;
    const target = entry.directedFrom === entry.a ? entry.b : entry.a;
    const set = byNode.get(source) ?? new Set<string>();
    set.add(target);
    byNode.set(source, set);
  }
  return byNode;
}

function rowEndpoints(entry: RelationshipEntry): string[] {
  if (entry.directedFrom) return [entry.directedFrom];
  return [entry.a, entry.b];
}

function audit(): void {
  const isATargets = isATargetsByNode();
  const mismatches = new Map<string, number>();
  let total = 0;

  for (const entry of relFile.relationships) {
    const via = entry.properties?.via_database;
    if (typeof via !== "string" || !via.trim()) continue;

    const endpoints = rowEndpoints(entry);
    const matchesMembership = endpoints.some((nodeId) => isATargets.get(nodeId)?.has(via));
    if (matchesMembership) continue;

    total += 1;
    mismatches.set(via, (mismatches.get(via) ?? 0) + 1);
  }

  console.log(`via_database mismatches (via ≠ row is_a target): ${total}`);
  for (const [dbId, count] of [...mismatches.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${dbId}: ${count}`);
  }
}

function stripViaDatabase(): number {
  let removed = 0;
  for (const entry of relFile.relationships) {
    if (!entry.properties || !("via_database" in entry.properties)) continue;
    const { via_database: _drop, ...rest } = entry.properties;
    removed += 1;
    if (Object.keys(rest).length === 0) {
      delete entry.properties;
    } else {
      entry.properties = rest;
    }
  }
  return removed;
}

if (auditOnly) {
  audit();
} else {
  const removed = stripViaDatabase();
  const message = dryRun
    ? `[dry-run] would remove via_database from ${removed} edges`
    : `Removed via_database from ${removed} edges`;
  console.log(message);
  if (!dryRun && removed > 0) {
    writeFileSync(
      relPath,
      serializeRelationshipsFile({
        version: RELATIONSHIPS_FILE_VERSION,
        relationships: relFile.relationships,
      }),
      "utf-8",
    );
  }
}
