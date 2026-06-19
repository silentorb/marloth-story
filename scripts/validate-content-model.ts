#!/usr/bin/env bun
/**
 * CI guard: fail if node frontmatter still contains legacy Notion provenance keys.
 *
 * Usage: bun run validate:content-model
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseNodeFile } from "../packages/tome-db/src/content/node-file";
import { contentDataDir, resolveContentPath } from "../packages/tome-db/src/content/paths";

const FORBIDDEN_KEYS = [
  "notion_id",
  "notion_schema",
  "notion_database",
  "notion_url",
  "notion_archived",
  "notion_views",
  "source_export",
] as const;

const contentRoot = resolveContentPath();
const dataDir = contentDataDir(contentRoot);
const violations: string[] = [];

for (const file of readdirSync(dataDir)) {
  if (!file.endsWith(".md")) continue;
  const nodeId = file.slice(0, 32);
  const raw = readFileSync(resolve(dataDir, file), "utf-8");
  const parsed = parseNodeFile(nodeId, raw);
  const found = FORBIDDEN_KEYS.filter((key) => key in parsed.properties);
  if (found.length > 0) {
    violations.push(`${file}: ${found.join(", ")}`);
  }
}

if (violations.length > 0) {
  console.error(`Found ${violations.length} node(s) with legacy Notion frontmatter keys:`);
  for (const line of violations.slice(0, 30)) {
    console.error(`  ${line}`);
  }
  if (violations.length > 30) {
    console.error(`  ... and ${violations.length - 30} more`);
  }
  process.exit(1);
}

console.log("Content model OK (no legacy Notion frontmatter keys)");
