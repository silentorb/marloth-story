#!/usr/bin/env bun
/**
 * CI guard: validate content/model/workspace.json structure and node references.
 *
 * Usage: bun run validate:workspace
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { contentDataDir, resolveContentPath } from "../packages/tome-db/src/content/paths";
import { parseWorkspaceFile } from "../packages/tome-db/src/workspace/workspace-file";

const contentRoot = resolveContentPath();
const workspacePath = resolve(contentRoot, "model", "workspace.json");
const raw = readFileSync(workspacePath, "utf-8");
const workspace = parseWorkspaceFile(raw);

const nodeIds = new Set<string>([
  workspace.homeNodeId,
  workspace.archiveNodeId,
  ...workspace.protectedNodeIds,
  workspace.graphExplorer.defaultAnchorNodeId,
  workspace.staticSite.homeNodeId,
  ...workspace.sidebar.links.map((link) => link.nodeId),
]);

const dataDir = contentDataDir(contentRoot);
const missing: string[] = [];

for (const id of nodeIds) {
  const path = resolve(dataDir, `${id}.md`);
  if (!existsSync(path)) {
    missing.push(id);
  }
}

if (missing.length > 0) {
  console.error(`workspace.json references ${missing.length} node(s) missing from content/data/:`);
  for (const id of missing.slice(0, 30)) {
    console.error(`  ${id}.md`);
  }
  if (missing.length > 30) {
    console.error(`  ... and ${missing.length - 30} more`);
  }
  process.exit(1);
}

console.log(`Workspace OK (${nodeIds.size} referenced nodes present under content/data/)`);
