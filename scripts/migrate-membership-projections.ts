#!/usr/bin/env bun
/**
 * Migrate set membership: strip directedFrom on is_a, convert archive includes→is_a,
 * backfill row metadata, add views.json entries for legacy type tables.
 *
 * Usage: bun scripts/migrate-membership-projections.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_ROOT = join(import.meta.dir, "../content");
const RELATIONSHIPS_PATH = join(CONTENT_ROOT, "data/relationships.json");
const RELATIONSHIP_TYPES_PATH = join(CONTENT_ROOT, "model/relationship-types.json");
const WORKSPACE_PATH = join(CONTENT_ROOT, "model/workspace.json");
const TABLE_SCHEMAS_PATH = join(CONTENT_ROOT, "model/table-schemas.json");
const VIEWS_PATH = join(CONTENT_ROOT, "model/views.json");

const dryRun = process.argv.includes("--dry-run");

interface RelationshipEntry {
  a: string;
  b: string;
  type: string;
  directedFrom?: string;
  archived?: boolean;
  properties?: Record<string, unknown>;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function main(): void {
  const workspace = loadJson<{ archiveNodeId: string }>(WORKSPACE_PATH);
  const archiveHubId = workspace.archiveNodeId;

  const relFile = loadJson<{ version: number; relationships: RelationshipEntry[] }>(
    RELATIONSHIPS_PATH,
  );
  const tableSchemas = loadJson<{ tables: Record<string, unknown> }>(TABLE_SCHEMAS_PATH);
  const typeTableIds = new Set(Object.keys(tableSchemas.tables ?? {}));

  let strippedDirectedFrom = 0;
  let archiveConverted = 0;
  let rowMetaBackfilled = 0;

  const rowIndexBySet = new Map<string, number>();

  for (const entry of relFile.relationships) {
    if (entry.type === "is_a") {
      if (entry.directedFrom) {
        delete entry.directedFrom;
        strippedDirectedFrom++;
      }

      const setId = typeTableIds.has(entry.a)
        ? entry.a
        : typeTableIds.has(entry.b)
          ? entry.b
          : null;
      if (setId) {
        const props = (entry.properties ??= {});
        if (props.view === undefined) {
          const peerHasView = relFile.relationships.some(
            (r) =>
              r.type === "is_a" &&
              r !== entry &&
              (r.a === setId || r.b === setId) &&
              r.properties?.view !== undefined,
          );
          props.view = peerHasView ? "All" : "default";
          rowMetaBackfilled++;
        }
        if (props.row_index === undefined) {
          const next = (rowIndexBySet.get(setId) ?? -1) + 1;
          rowIndexBySet.set(setId, next);
          props.row_index = next;
          rowMetaBackfilled++;
        }
      }
    }

    if (
      entry.type === "includes" &&
      (entry.a === archiveHubId || entry.b === archiveHubId) &&
      entry.archived !== true
    ) {
      entry.type = "is_a";
      delete entry.directedFrom;
      archiveConverted++;
    }
  }

  const typesFile = loadJson<{ version: number; types: Record<string, unknown> }>(
    RELATIONSHIP_TYPES_PATH,
  );
  typesFile.types.is_a = {
    bidirectional: true,
    perspectives: ["is_a", "members"],
  };

  const viewsFile = loadJson<{ version: number; nodes: Record<string, unknown> }>(VIEWS_PATH);
  for (const typeId of typeTableIds) {
    const nodeConfig = viewsFile.nodes[typeId] as Record<string, unknown> | undefined;
    const sections = (nodeConfig?.sections ?? {}) as Record<string, unknown>;
    if (sections.items) continue;
    viewsFile.nodes[typeId] = {
      ...(nodeConfig ?? {}),
      sections: {
        ...sections,
        items: {
          tabs: {
            kind: "custom",
            definitions: [{ id: "all", name: "All", sorts: [] }],
          },
        },
      },
    };
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        strippedDirectedFrom,
        archiveConverted,
        rowMetaBackfilled,
        viewsAdded: [...typeTableIds].filter((id) => {
          const sections = (viewsFile.nodes[id] as { sections?: { items?: unknown } })?.sections;
          return Boolean(sections?.items);
        }).length,
      },
      null,
      2,
    ),
  );

  if (dryRun) return;

  writeFileSync(RELATIONSHIPS_PATH, `${JSON.stringify(relFile, null, 2)}\n`);
  writeFileSync(RELATIONSHIP_TYPES_PATH, `${JSON.stringify(typesFile, null, 2)}\n`);
  writeFileSync(VIEWS_PATH, `${JSON.stringify(viewsFile, null, 2)}\n`);
  console.log("Migration complete.");
}

main();
