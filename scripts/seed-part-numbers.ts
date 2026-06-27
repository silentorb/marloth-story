/**
 * Backfill the Parts database `number` property from part titles.
 *
 * Usage: bun scripts/seed-part-numbers.ts [--dry-run]
 */
import { resolve } from "node:path";
import { ContentStore } from "../packages/tome-db/src/content/store";
import { partNumberFromTitle } from "../packages/tome-db/src/part-number";

const PARTS_DB = "5e45eefc69a14f45b988ad1f3c9d1ef5";
const REPO_ROOT = resolve(import.meta.dir, "..");
const CONTENT_DIR = process.env.MARLOTH_CONTENT_PATH ?? resolve(REPO_ROOT, "content");

const dryRun = process.argv.includes("--dry-run");
const store = new ContentStore(CONTENT_DIR);

function titleFromNodeProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

function isPartsMembership(entry: { a: string; b: string; type: string; directedFrom?: string }): boolean {
  if (entry.type !== "member_of") return false;
  return entry.a === PARTS_DB || entry.b === PARTS_DB;
}

function partIdFromMembership(entry: { a: string; b: string; directedFrom?: string }): string | null {
  if (entry.directedFrom && entry.directedFrom !== PARTS_DB) return entry.directedFrom;
  if (entry.a === PARTS_DB) return entry.b;
  if (entry.b === PARTS_DB) return entry.a;
  return null;
}

const relationshipsFile = store.readRelationshipsFile();
let updated = 0;
let skipped = 0;

for (const entry of relationshipsFile.relationships) {
  if (!isPartsMembership(entry)) continue;
  const partId = partIdFromMembership(entry);
  if (!partId) continue;

  const node = store.readNode(partId);
  if (!node) {
    console.warn(`Part node not found: ${partId}`);
    skipped += 1;
    continue;
  }

  const number = partNumberFromTitle(titleFromNodeProperties(node.properties));
  if (number === null) {
    console.warn(`No number derived for part ${partId}: ${titleFromNodeProperties(node.properties)}`);
    skipped += 1;
    continue;
  }

  const nextValue = String(number);
  if (entry.properties?.number === nextValue) continue;

  updated += 1;
  console.log(`${titleFromNodeProperties(node.properties)} → number ${nextValue}`);
  if (!dryRun) {
    entry.properties = { ...(entry.properties ?? {}), number: nextValue };
  }
}

console.log(
  dryRun
    ? `[dry-run] would update ${updated} part membership(s), skipped ${skipped}`
    : `Updated ${updated} part membership(s), skipped ${skipped}`,
);

if (!dryRun && updated > 0) {
  store.writeRelationshipsFile(relationshipsFile);
}
