#!/usr/bin/env bun
/**
 * One-time migration: views.json v1 (nested nodes/sections/tabs) → v2 (flat views[]).
 *
 * Usage: bun scripts/migrate-views-json-v2.ts [path/to/views.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serializeViewsFile, type ViewRecord, type ViewsFile } from "../../tome/packages/tome-db/src/content/views-file.ts";

const defaultPath = resolve(import.meta.dir, "../content/model/views.json");

interface V1CustomTab {
  id: string;
  name: string;
  sorts: { column: string; direction: "asc" | "desc" }[];
}

interface V1Section {
  columnOrder?: string[];
  tabs:
    | { kind: "custom"; definitions: V1CustomTab[] }
    | { kind: "generated"; provider: string };
}

interface V1File {
  version: number;
  nodes: Record<string, { sections: Record<string, V1Section> }>;
}

function migrateV1ToV2(v1: V1File): ViewsFile {
  const views: ViewRecord[] = [];

  for (const [nodeId, nodeConfig] of Object.entries(v1.nodes)) {
    for (const [relationshipType, section] of Object.entries(nodeConfig.sections)) {
      const properties =
        section.columnOrder && section.columnOrder.length > 0
          ? { columnOrder: [...section.columnOrder] }
          : undefined;

      if (section.tabs.kind === "generated") {
        views.push({
          nodeId: nodeId.toLowerCase(),
          relationshipType,
          generator: section.tabs.provider,
        });
        continue;
      }

      for (const definition of section.tabs.definitions) {
        views.push({
          id: definition.id,
          nodeId: nodeId.toLowerCase(),
          relationshipType,
          name: definition.name,
          sorts: definition.sorts.map((sort) => ({
            column: sort.column,
            direction: sort.direction,
          })),
          ...(properties ? { properties: { columnOrder: [...properties.columnOrder!] } } : {}),
        });
      }
    }
  }

  return { version: 2, views };
}

const targetPath = process.argv[2] ? resolve(process.argv[2]) : defaultPath;
const raw = readFileSync(targetPath, "utf-8");
const v1 = JSON.parse(raw) as V1File;

if (v1.version !== 1) {
  console.error(`Expected views.json version 1, got ${v1.version}`);
  process.exit(1);
}

const v2 = migrateV1ToV2(v1);
writeFileSync(targetPath, serializeViewsFile(v2), "utf-8");
console.log(`Migrated ${targetPath}: ${v2.views.length} view record(s)`);
