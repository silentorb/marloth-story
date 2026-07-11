/**
 * One-time migration: rewrite internal node links in markdown bodies to `./{nodeId}.md`.
 *
 * Usage: bun scripts/canonicalize-markdown-links.ts [--dry-run]
 */
import { canonicalizeMarkdownBodyLinks } from "tome-flatfile/markdown-links";
import { ContentStore, bodyFromNode, resolveContentPath } from "tome-db/content";

const dryRun = process.argv.includes("--dry-run");

const contentDir = resolveContentPath();
const store = new ContentStore(contentDir);

let updated = 0;
let unchanged = 0;

for (const id of store.listNodeIds()) {
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
