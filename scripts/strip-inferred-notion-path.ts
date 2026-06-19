/**
 * One-time migration: remove legacy `inferred_notion_path` from node frontmatter.
 *
 * Usage: bun scripts/strip-inferred-notion-path.ts [--dry-run]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ContentStore, bodyFromNode, resolveContentPath } from "tome-db/content";

const dryRun = process.argv.includes("--dry-run");

const contentDir = resolveContentPath();
const store = new ContentStore(contentDir);
const dataDir = join(contentDir, "data");

let stripped = 0;
let skipped = 0;

for (const name of readdirSync(dataDir)) {
  if (!name.endsWith(".md")) continue;
  const id = name.slice(0, -3);
  const node = store.readNode(id);
  if (!node) continue;

  if (!("inferred_notion_path" in node.properties)) {
    skipped++;
    continue;
  }

  const { inferred_notion_path: _removed, ...rest } = node.properties;
  stripped++;
  if (dryRun) {
    console.log(`would strip ${id}`);
    continue;
  }
  store.writeNode({ id: node.id, properties: rest }, bodyFromNode(node));
}

console.log(
  dryRun
    ? `Dry run: would strip inferred_notion_path from ${stripped} nodes (${skipped} unchanged)`
    : `Stripped inferred_notion_path from ${stripped} nodes (${skipped} unchanged)`,
);
