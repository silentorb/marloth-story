/**
 * One-time migration: replace static node links whose title matches the target
 * node title (or alias) with dynamic `[[nodeId]]` links.
 *
 * Usage:
 *   bun scripts/migrate-static-links-to-dynamic.ts [--dry-run]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  linkTextMatchesNodeTitle,
  migrateStaticLinksInBodies,
} from "marloth-db/dynamic-node-links";
import { ContentStore, bodyFromNode, resolveContentPath } from "marloth-db/content";

const dryRun = process.argv.includes("--dry-run");

function displayNamesFromProperties(properties: Record<string, unknown>): string[] {
  const names: string[] = [];
  const title = properties.title;
  if (typeof title === "string" && title.trim()) names.push(title.trim());
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) {
    const trimmed = alias.trim();
    if (!names.some((name) => linkTextMatchesNodeTitle(name, trimmed))) {
      names.push(trimmed);
    }
  }
  return names;
}

const contentDir = resolveContentPath();
const store = new ContentStore(contentDir);
const dataDir = join(contentDir, "data");

const nameCache = new Map<string, string[]>();

function namesForId(nodeId: string): string[] {
  const cached = nameCache.get(nodeId);
  if (cached) return cached;
  const node = store.readNode(nodeId);
  const names = node ? displayNamesFromProperties(node.properties) : [];
  nameCache.set(nodeId, names);
  return names;
}

const entries: Array<{ id: string; body: string }> = [];
for (const name of readdirSync(dataDir)) {
  if (!name.endsWith(".md")) continue;
  const id = name.slice(0, -3);
  const node = store.readNode(id);
  if (!node) continue;
  entries.push({ id, body: bodyFromNode(node) });
}

const { bodies, report } = migrateStaticLinksInBodies(entries, namesForId);

if (!dryRun) {
  for (const { id, body } of entries) {
    const nextBody = bodies.get(id);
    if (!nextBody || nextBody === body) continue;
    const node = store.readNode(id);
    if (!node) continue;
    store.writeNode(node, nextBody);
  }
}

console.log(
  dryRun
    ? `dry-run: ${report.filesChanged} file(s) would change, ${report.filesUnchanged} unchanged`
    : `updated ${report.filesChanged} file(s), ${report.filesUnchanged} unchanged`,
);
console.log(
  `links: ${report.linksConverted} converted to [[node-id]], ${report.linksSkippedCustomText} left static (custom anchor text)`,
);
