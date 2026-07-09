#!/usr/bin/env bun
/**
 * Migrate includes collapse to per-flavor relationship types (named composite SSOT).
 *
 * Usage: bun scripts/migrate-named-composite-ssot.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compositeTypeForPerspectives,
  parseRelationshipTypesFile,
  serializeRelationshipTypesFile,
  type RelationshipTypeDefinition,
} from "/workspaces/tome/packages/tome-db/src/content/relationship-types-file";
import {
  relationshipsFilePath,
  relationshipTypesFilePath,
  resolveContentPath,
  schemaFilePath,
  tableSchemasFilePath,
} from "/workspaces/tome/packages/tome-db/src/content/paths";
import {
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  serializeRelationshipsFile,
} from "/workspaces/tome/packages/tome-db/src/content/relationships-file";
import { normalizeRelationshipType } from "/workspaces/tome/packages/tome-db/src/relation-type";
import { serializeTableSchemasFile } from "/workspaces/tome/packages/tome-db/src/content/table-schemas-file";
import { serializeSchemaFile } from "/workspaces/tome/packages/tome-db/src/schema-rules/schema-file";

const contentRoot = resolveContentPath(resolve(import.meta.dir, ".."));
const dryRun = process.argv.includes("--dry-run");

interface OldRelationColumn {
  key: string;
  name: string;
  type: "relation";
  targetTypeId: string;
  perspective?: string;
}

interface OldTableSchema {
  columns: Array<OldRelationColumn | { key: string; name: string; type: string }>;
  membershipComposite?: string;
}

function slugifyPropertyKey(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/[^a-z0-9_]+/g, "_");
  s = s.replace(/^_+|_+$/g, "").replace(/__+/g, "_");
  if (!s) s = "property";
  if (/^\d/.test(s)) s = `prop_${s}`;
  return s;
}

function perspectiveForColumn(col: OldRelationColumn): string {
  return normalizeRelationshipType(col.perspective ?? slugifyPropertyKey(col.name));
}

function findInversePerspective(
  tables: Record<string, OldTableSchema>,
  hostTypeId: string,
  targetTypeId: string,
): string {
  const targetSchema = tables[targetTypeId];
  if (!targetSchema) return "includes";
  for (const col of targetSchema.columns) {
    if (col.type !== "relation") continue;
    const rel = col as OldRelationColumn;
    if (rel.targetTypeId === hostTypeId) {
      return perspectiveForColumn(rel);
    }
  }
  return "includes";
}

function endpointsMatch(
  def: RelationshipTypeDefinition,
  hostTypeId: string,
  targetTypeId: string,
  perspective: string,
): boolean {
  if (!def.endpoints) return false;
  if (
    def.endpoints[0].typeId === hostTypeId &&
    def.endpoints[1].typeId === targetTypeId &&
    def.perspectives[0] === perspective
  ) {
    return true;
  }
  if (
    def.endpoints[1].typeId === hostTypeId &&
    def.endpoints[0].typeId === targetTypeId &&
    def.perspectives[1] === perspective
  ) {
    return true;
  }
  return false;
}

function findExistingComposite(
  types: Record<string, RelationshipTypeDefinition>,
  hostTypeId: string,
  targetTypeId: string,
  perspective: string,
): string | null {
  for (const [key, def] of Object.entries(types)) {
    if (endpointsMatch(def, hostTypeId, targetTypeId, perspective)) return key;
  }
  for (const [key, def] of Object.entries(types)) {
    if (!def.perspectives.includes(perspective)) continue;
    if (key === "includes") continue;
    const otherPerspective = def.perspectives[0] === perspective ? def.perspectives[1] : def.perspectives[0];
    const inverse = findInversePerspective({} as Record<string, OldTableSchema>, hostTypeId, targetTypeId);
    void inverse;
    const idx = def.perspectives.indexOf(perspective);
    if (idx === 0 && def.endpoints?.[0].typeId === hostTypeId && def.endpoints?.[1].typeId === targetTypeId) {
      return key;
    }
    if (idx === 1 && def.endpoints?.[1].typeId === hostTypeId && def.endpoints?.[0].typeId === targetTypeId) {
      return key;
    }
  }
  return null;
}

function ensureComposite(
  types: Record<string, RelationshipTypeDefinition>,
  hostTypeId: string,
  targetTypeId: string,
  perspective: string,
  inverse: string,
): string {
  const existing = findExistingComposite(types, hostTypeId, targetTypeId, perspective);
  if (existing) return existing;

  const candidate = compositeTypeForPerspectives(perspective, inverse);
  if (types[candidate] && !types[candidate].endpoints) {
    types[candidate] = {
      ...types[candidate],
      endpoints: {
        0: { typeId: hostTypeId },
        1: { typeId: targetTypeId },
      },
    };
    return candidate;
  }

  if (!types[candidate]) {
    types[candidate] = {
      perspectives: [perspective, inverse],
      endpoints: {
        0: { typeId: hostTypeId },
        1: { typeId: targetTypeId },
      },
    };
    return candidate;
  }

  if (endpointsMatch(types[candidate], hostTypeId, targetTypeId, perspective)) {
    return candidate;
  }

  const altKey = `${hostTypeId.slice(-4)}_${perspective}_${targetTypeId.slice(-4)}`;
  if (!types[altKey]) {
    types[altKey] = {
      perspectives: [perspective, inverse],
      endpoints: {
        0: { typeId: hostTypeId },
        1: { typeId: targetTypeId },
      },
    };
  }
  return altKey;
}

function memberTypeIds(
  relationships: RelationshipEntry[],
  nodeId: string,
  membershipTypes: Set<string>,
  tableTypeIds: Set<string>,
): string[] {
  const types = new Set<string>();
  if (tableTypeIds.has(nodeId)) types.add(nodeId);
  for (const entry of relationships) {
    if (!membershipTypes.has(normalizeRelationshipType(entry.type))) continue;
    // Set membership: parent (type table) at index 0, child (instance) at index 1.
    if (entry.b === nodeId) types.add(entry.a);
    else if (entry.a === nodeId) types.add(entry.b);
  }
  return [...types];
}

function resolveIncludesEdgeType(
  types: Record<string, RelationshipTypeDefinition>,
  relationships: RelationshipEntry[],
  entry: RelationshipEntry,
  membershipTypes: Set<string>,
  tableTypeIds: Set<string>,
): string | null {
  const typesA = new Set(memberTypeIds(relationships, entry.a, membershipTypes, tableTypeIds));
  const typesB = new Set(memberTypeIds(relationships, entry.b, membershipTypes, tableTypeIds));

  const matches: string[] = [];
  for (const [composite, def] of Object.entries(types)) {
    if (composite === "includes" || !def.endpoints) continue;
    const e0 = def.endpoints[0].typeId;
    const e1 = def.endpoints[1].typeId;
    const forward = typesA.has(e0) && typesB.has(e1);
    const reverse = typesA.has(e1) && typesB.has(e0);
    if (forward || reverse) {
      matches.push(composite);
      continue;
    }
    const union = new Set([...typesA, ...typesB]);
    if (union.has(e0) && union.has(e1)) matches.push(composite);
  }
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    const sorted = [...matches].sort();
    return sorted[0]!;
  }
  return null;
}

function main(): void {
  const typesPath = relationshipTypesFilePath(contentRoot);
  const tablesPath = tableSchemasFilePath(contentRoot);
  const relPath = relationshipsFilePath(contentRoot);
  const schemaPath = schemaFilePath(contentRoot);

  const typesFile = parseRelationshipTypesFile(readFileSync(typesPath, "utf-8"));
  const tablesRaw = JSON.parse(readFileSync(tablesPath, "utf-8")) as {
    version: number;
    tables: Record<string, OldTableSchema>;
  };
  const relFile = JSON.parse(readFileSync(relPath, "utf-8")) as {
    version: number;
    relationships: RelationshipEntry[];
  };
  const schemaRaw = JSON.parse(readFileSync(schemaPath, "utf-8")) as {
    version: number;
    relationshipRules?: unknown[];
    enums?: unknown;
  };

  const types = { ...typesFile.types };

  const columnComposites = new Map<string, string>();

  for (const [hostTypeId, schema] of Object.entries(tablesRaw.tables)) {
    for (const col of schema.columns) {
      if (col.type !== "relation") continue;
      const relCol = col as OldRelationColumn;
      const perspective = perspectiveForColumn(relCol);
      const inverse = findInversePerspective(tablesRaw.tables, hostTypeId, relCol.targetTypeId);
      const composite = ensureComposite(
        types,
        hostTypeId,
        relCol.targetTypeId,
        perspective,
        inverse,
      );
      columnComposites.set(`${hostTypeId}:${relCol.key}`, composite);
    }
  }

  for (const rule of schemaRaw.relationshipRules ?? []) {
    const r = rule as {
      sourceTypeId: string;
      type: string;
      allowedTargetTypeIds: string[];
    };
    if (!r.sourceTypeId || !r.allowedTargetTypeIds?.length) continue;
    const perspective = normalizeRelationshipType(r.type);
    for (const targetTypeId of r.allowedTargetTypeIds) {
      const inverse = findInversePerspective(tablesRaw.tables, r.sourceTypeId, targetTypeId);
      ensureComposite(types, r.sourceTypeId, targetTypeId, perspective, inverse);
    }
  }

  const newTables: Record<string, { columns: unknown[]; membershipComposite?: string }> = {};
  for (const [hostTypeId, schema] of Object.entries(tablesRaw.tables)) {
    const columns = schema.columns.map((col) => {
      if (col.type !== "relation") return col;
      const relCol = col as OldRelationColumn;
      const composite = columnComposites.get(`${hostTypeId}:${relCol.key}`)!;
      return {
        key: relCol.key,
        name: relCol.name,
        type: "relation",
        relationshipType: composite,
      };
    });
    newTables[hostTypeId] = {
      columns,
      ...(schema.membershipComposite ? { membershipComposite: schema.membershipComposite } : {}),
    };
  }

  const membershipTypes = new Set(
    Object.entries(types)
      .filter(([, def]) => def.traits?.some((t) => (typeof t === "string" ? t : t.key) === "set"))
      .map(([key]) => key),
  );
  membershipTypes.add("member_of");
  membershipTypes.add("ordered_member_of");
  const tableTypeIds = new Set(Object.keys(tablesRaw.tables));

  let migratedEdges = 0;
  let unresolvedEdges = 0;
  let droppedArchived = 0;
  const relationships: RelationshipEntry[] = [];
  for (const entry of relFile.relationships) {
    if (normalizeRelationshipType(entry.type) !== "includes") {
      relationships.push(entry);
      continue;
    }
    const resolved = resolveIncludesEdgeType(
      types,
      relFile.relationships,
      entry,
      membershipTypes,
      tableTypeIds,
    );
    if (!resolved) {
      unresolvedEdges++;
      if (entry.archived) {
        droppedArchived++;
        console.warn(`dropping archived unresolved includes: ${entry.a} <-> ${entry.b}`);
        continue;
      }
      console.warn(`unresolved includes edge: ${entry.a} <-> ${entry.b}`);
      relationships.push(entry);
      continue;
    }
    migratedEdges++;
    relationships.push({ ...entry, type: resolved });
  }

  const remainingIncludes = relationships.some((e) => normalizeRelationshipType(e.type) === "includes");
  if (remainingIncludes) {
    types.includes = { perspectives: ["includes", "includes"] };
  } else {
    delete types.includes;
  }

  const schemaOut = {
    version: schemaRaw.version,
    ...(schemaRaw.enums ? { enums: schemaRaw.enums } : {}),
  };

  console.log(`Composites in registry: ${Object.keys(types).length}`);
  console.log(
    `Migrated includes edges: ${migratedEdges}, unresolved kept: ${unresolvedEdges - droppedArchived}, dropped archived: ${droppedArchived}`,
  );

  if (dryRun) {
    console.log("Dry run — no files written.");
    return;
  }

  writeFileSync(typesPath, serializeRelationshipTypesFile({ version: 1, types }));
  writeFileSync(tablesPath, serializeTableSchemasFile({ version: 1, tables: newTables as never }));
  writeFileSync(
    relPath,
    serializeRelationshipsFile({ version: RELATIONSHIPS_FILE_VERSION, relationships }),
  );
  writeFileSync(schemaPath, serializeSchemaFile(schemaOut as never));
  console.log("Migration complete.");
}

main();
