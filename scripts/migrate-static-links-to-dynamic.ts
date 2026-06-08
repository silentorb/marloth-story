/**
 * One-time migration: replace static node links whose title matches the target
 * node title with dynamic `[[nodeId]]` links.
 *
 * Usage: bun scripts/migrate-static-links-to-dynamic.ts [--dry-run]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { migrateStaticLinksToDynamic } from "marloth-db/dynamic-node-links";
import { ContentStore, bodyFromNode, resolveContentPath } from "marloth-db/content";

const dryRun = process.argv.includes("--dry-run");

function titleFromProperties(properties: Record<string, unknown>): string | null {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return null;
}

const contentDir = resolveContentPath();
const store = new ContentStore(contentDir);
const dataDir = join(contentDir, "data");

const titleCache = new Map<string, string | null>();

function titleForId(nodeId: string): string | null {
  const cached = titleCache.get(nodeId);
  if (cached !== undefined) return cached;
  const node = store.readNode(nodeId);
  const title = node ? titleFromProperties(node.properties) : null;
  titleCache.set(nodeId, title);
  return title;
}

let updated = 0;
let unchanged = 0;

for (const name of readdirSync(dataDir)) {
  if (!name.endsWith(".md")) continue;
  const id = name.slice(0, -3);
  const node = store.readNode(id);
  if (!node) continue;

  const body = bodyFromNode(node);
  const nextBody = migrateStaticLinksToDynamic(body, titleForId);
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
