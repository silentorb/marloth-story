#!/usr/bin/env bun
/**
 * Remove legacy Notion view / via_view relationship properties.
 * Relationships are not view-scoped; UI tabs live in views.json.
 *
 * Usage:
 *   bun scripts/migrate-remove-view-props.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const KEYS_TO_STRIP = ["via_view", "view"] as const;

const contentRoot = resolve(import.meta.dir, "../content");
const relPath = resolve(contentRoot, "data/relationships.json");
const dryRun = process.argv.includes("--dry-run");

interface RelationshipEntry {
  a: string;
  b: string;
  type: string;
  archived?: boolean;
  properties?: Record<string, unknown>;
}

const relFile = JSON.parse(readFileSync(relPath, "utf-8")) as {
  version: number;
  relationships: RelationshipEntry[];
};

function stripViewProps(): { viaView: number; view: number } {
  let viaView = 0;
  let view = 0;
  for (const entry of relFile.relationships) {
    if (!entry.properties) continue;
    const next: Record<string, unknown> = { ...entry.properties };
    let changed = false;
    for (const key of KEYS_TO_STRIP) {
      if (!(key in next)) continue;
      if (key === "via_view") viaView += 1;
      else view += 1;
      delete next[key];
      changed = true;
    }
    if (!changed) continue;
    if (Object.keys(next).length === 0) {
      delete entry.properties;
    } else {
      entry.properties = next;
    }
  }
  return { viaView, view };
}

const removed = stripViewProps();
const total = removed.viaView + removed.view;
const message = dryRun
  ? `[dry-run] would remove via_view from ${removed.viaView} edges and view from ${removed.view} edges`
  : `Removed via_view from ${removed.viaView} edges and view from ${removed.view} edges`;
console.log(message);

if (!dryRun && total > 0) {
  writeFileSync(relPath, `${JSON.stringify(relFile, null, 2)}\n`, "utf-8");
}
