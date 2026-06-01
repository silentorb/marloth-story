#!/usr/bin/env bun
/**
 * Consolidate v1 directed relationship pairs into v2 bidirectional records,
 * normalize types to lower snake_case, and emit relationship-types.json.
 *
 * Usage: bun scripts/consolidate-relationships.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  relationshipsFilePath,
  relationshipTypesFilePath,
  schemaFilePath,
  resolveContentPath,
} from "../packages/marloth-db/src/content/paths";
import {
  compositeTypeForPerspectives,
  emptyRelationshipTypesFile,
  registerBidirectionalType,
  registerTypeDefinition,
  registerUnidirectionalType,
  serializeRelationshipTypesFile,
} from "../packages/marloth-db/src/content/relationship-types-file";
import {
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  serializeRelationshipsFile,
  sortEndpoints,
} from "../packages/marloth-db/src/content/relationships-file";
import { normalizeRelationshipType } from "../packages/marloth-db/src/relation-type";

const contentRoot = resolveContentPath(resolve(import.meta.dir, ".."));
const dryRun = process.argv.includes("--dry-run");

interface V1Edge {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

function loadV1(): V1Edge[] {
  const raw = readFileSync(relationshipsFilePath(contentRoot), "utf-8");
  const data = JSON.parse(raw) as { relationships: Record<string, unknown>[] };
  const edges: V1Edge[] = [];
  for (const row of data.relationships) {
    const source = String(row.source ?? "");
    const target = String(row.target ?? "");
    const type = normalizeRelationshipType(String(row.label ?? row.type ?? ""));
    const properties =
      row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)
        ? (row.properties as Record<string, unknown>)
        : {};
    if (!source || !target || !type) continue;
    edges.push({ source, target, type, properties });
  }
  return edges;
}

function edgeKey(source: string, target: string, type: string): string {
  return `${source}:${target}:${type}`;
}

function mergeProperties(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const score = (p: Record<string, unknown>) =>
    (p.via_database ? 4 : 0) + (p.ordinal !== undefined ? 2 : 0) + Object.keys(p).length;
  return score(a) >= score(b) ? { ...b, ...a } : { ...a, ...b };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function main(): void {
  const v1 = loadV1();
  const used = new Set<string>();
  const v2: RelationshipEntry[] = [];
  const registry = emptyRelationshipTypesFile();

  const byPair = new Map<string, V1Edge[]>();
  for (const edge of v1) {
    const pk = pairKey(edge.source, edge.target);
    const list = byPair.get(pk) ?? [];
    list.push(edge);
    byPair.set(pk, list);
  }

  let pairsMerged = 0;
  let orphansKept = 0;

  for (const [, group] of byPair) {
    const unmatched = [...group];

    while (unmatched.length > 0) {
      const forward = unmatched.shift()!;
      const reverseIdx = unmatched.findIndex(
        (e) => e.source === forward.target && e.target === forward.source,
      );

      if (reverseIdx >= 0) {
        const reverse = unmatched.splice(reverseIdx, 1)[0]!;
        used.add(edgeKey(forward.source, forward.target, forward.type));
        used.add(edgeKey(reverse.source, reverse.target, reverse.type));

        const { a, b } = sortEndpoints(forward.source, forward.target);
        const typeFromA =
          forward.source === a ? forward.type : reverse.type;
        const typeFromB =
          forward.source === a ? reverse.type : forward.type;
        const composite = compositeTypeForPerspectives(typeFromA, typeFromB);

        registerTypeDefinition(registry, composite, {
          bidirectional: true,
          perspectives: [typeFromA, typeFromB],
        });

        v2.push({
          a,
          b,
          type: composite,
          properties: mergeProperties(forward.properties, reverse.properties),
        });
        pairsMerged++;
      } else {
        used.add(edgeKey(forward.source, forward.target, forward.type));
        const { a, b } = sortEndpoints(forward.source, forward.target);
        const normalized = forward.type;

        registerUnidirectionalType(registry, normalized);
        v2.push({
          a,
          b,
          type: normalized,
          directedFrom: forward.source,
          properties: forward.properties,
        });
        orphansKept++;
      }
    }
  }

  v2.sort((x, y) =>
    x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.type.localeCompare(y.type),
  );

  console.log(`v1 edges: ${v1.length}`);
  console.log(`pairs merged: ${pairsMerged}`);
  console.log(`unidirectional kept: ${orphansKept}`);
  console.log(`v2 records: ${v2.length}`);
  console.log(`registry types: ${Object.keys(registry.types).length}`);

  if (dryRun) {
    console.log("\n(dry run — no files written)");
    return;
  }

  writeFileSync(
    relationshipsFilePath(contentRoot),
    serializeRelationshipsFile({ version: RELATIONSHIPS_FILE_VERSION, relationships: v2 }),
  );
  writeFileSync(
    relationshipTypesFilePath(contentRoot),
    serializeRelationshipTypesFile(registry),
  );

  // Migrate schema.json label → type, lowercase
  const schemaPath = schemaFilePath(contentRoot);
  try {
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as {
      version: number;
      relationshipRules: { id: string; sourceTypeId: string; label?: string; type?: string; allowedTargetTypeIds: string[] }[];
    };
    for (const rule of schema.relationshipRules) {
      const raw = rule.type ?? rule.label ?? "";
      rule.type = normalizeRelationshipType(raw);
      delete rule.label;
    }
    writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
    console.log("migrated schema.json");
  } catch {
    /* optional */
  }

  console.log("done");
}

main();
