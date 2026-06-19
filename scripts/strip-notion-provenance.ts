#!/usr/bin/env bun
/**
 * One-time migration: remove legacy Notion provenance keys from node frontmatter.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseNodeFile, serializeNodeFile } from "../packages/tome-db/src/content/node-file";
import { contentDataDir, resolveContentPath } from "../packages/tome-db/src/content/paths";

const PROVENANCE_KEYS = [
  "notion_id",
  "source_export",
  "notion_database",
  "notion_url",
  "created_at",
  "modified_at",
  "notion_archived",
] as const;

const dryRun = process.argv.includes("--dry-run");
const contentRoot = resolveContentPath();
const dataDir = contentDataDir(contentRoot);

let stripped = 0;
let skipped = 0;

for (const file of readdirSync(dataDir)) {
  if (!file.endsWith(".md")) continue;
  const nodeId = file.slice(0, 32);
  const path = resolve(dataDir, file);
  const raw = readFileSync(path, "utf-8");
  const parsed = parseNodeFile(nodeId, raw);

  const hasProvenance = PROVENANCE_KEYS.some((key) => key in parsed.properties);
  if (!hasProvenance) {
    skipped += 1;
    continue;
  }

  const nextProperties = { ...parsed.properties };
  for (const key of PROVENANCE_KEYS) {
    delete nextProperties[key];
  }

  if (!dryRun) {
    writeFileSync(path, serializeNodeFile({ id: nodeId, properties: nextProperties }, parsed.body), "utf-8");
  }
  stripped += 1;
}

console.log(
  dryRun
    ? `[dry-run] would strip provenance from ${stripped} nodes (${skipped} unchanged)`
    : `Stripped provenance from ${stripped} nodes (${skipped} unchanged)`,
);
