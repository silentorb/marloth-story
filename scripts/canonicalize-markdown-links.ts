/**
 * One-time migration: rewrite internal node links in markdown bodies to `./{nodeId}.md`.
 *
 * Usage: bun scripts/canonicalize-markdown-links.ts [--dry-run]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalizeMarkdownBodyLinks } from "marloth-db/markdown-links";
import { ContentStore, bodyFromNode, resolveContentPath } from "marloth-db/content";

const dryRun = process.argv.includes("--dry-run");

const contentDir = resolveContentPath();
const store = new ContentStore(contentDir);
const dataDir = join(contentDir, "data");

let updated = 0;
let unchanged = 0;

for (const name of readdirSync(dataDir)) {
  if (!name.endsWith(".md")) continue;
  const id = name.slice(0, -3);
  const node = store.readNode(id);
  if (!node) continue;

  const body = bodyFromNode(node);
  const nextBody = canonicalizeMarkdownBodyLinks(body);
  if (nextBody === body) {
    unchanged++;
    continue;
  }

  updated++;
  if (dryRun) {
    console.log(`would update ${id}`);
    continue;
  }
  store.writeNode(node, nextBody);
}

console.log(
  dryRun
    ? `dry-run: ${updated} file(s) would change, ${unchanged} unchanged`
    : `updated ${updated} file(s), ${unchanged} unchanged`,
);
