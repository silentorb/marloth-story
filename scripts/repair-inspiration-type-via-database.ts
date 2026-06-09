/**
 * Repair inspiration Type edges imported from the nested Extended story CSV.
 *
 * Sets via_database to the main Inspirations database and normalizes legacy
 * unidirectional prop_type records to prop_type_inspirations when safe.
 *
 * Usage: bun scripts/repair-inspiration-type-via-database.ts [--dry-run]
 */
import { resolve } from "node:path";
import { ContentStore } from "../packages/marloth-db/src/content/store";
import type { RelationshipEntry } from "../packages/marloth-db/src/content/relationships-file";
import { sortEndpoints } from "../packages/marloth-db/src/content/relationships-file";

const INSPIRATIONS_DB = "2eea538996934ce8abafc27132e576c1";
const INSPIRATION_TYPES_DB = "819dc2fea6cc4cddb5fce9cc4efd0e85";
const EXTENDED_STORY_DB = "1149175cc56d45e1b9f96a7455144ae4";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CONTENT_DIR = process.env.MARLOTH_CONTENT_PATH ?? resolve(REPO_ROOT, "content");

const dryRun = process.argv.includes("--dry-run");
const store = new ContentStore(CONTENT_DIR);

const relationshipsFile = store.readRelationshipsFile();
const typeMembers = new Set<string>();
for (const entry of relationshipsFile.relationships) {
  if (entry.type !== "is_a") continue;
  if (entry.b === INSPIRATION_TYPES_DB) typeMembers.add(entry.a);
  if (entry.a === INSPIRATION_TYPES_DB) typeMembers.add(entry.b);
}

function isInspirationTypeEdge(entry: RelationshipEntry): boolean {
  return typeMembers.has(entry.a) || typeMembers.has(entry.b);
}

function pairKey(a: string, b: string, type: string): string {
  const sorted = sortEndpoints(a, b);
  return `${sorted.a}:${sorted.b}:${type}`;
}

const existingPairs = new Set(
  relationshipsFile.relationships.map((e) => pairKey(e.a, e.b, e.type)),
);

let viaDatabaseUpdates = 0;
let normalizedToComposite = 0;

for (const entry of relationshipsFile.relationships) {
  if (entry.type !== "prop_type_inspirations" && entry.type !== "prop_type") continue;
  if (entry.properties?.via_database !== EXTENDED_STORY_DB) continue;
  if (!isInspirationTypeEdge(entry)) continue;

  viaDatabaseUpdates += 1;
  if (!dryRun) {
    entry.properties = {
      ...entry.properties,
      via_database: INSPIRATIONS_DB,
    };
  }

  if (entry.type !== "prop_type") continue;

  const compositeKey = pairKey(entry.a, entry.b, "prop_type_inspirations");
  if (existingPairs.has(compositeKey)) continue;

  normalizedToComposite += 1;
  if (!dryRun) {
    const { directedFrom: _drop, ...rest } = entry;
    entry.type = "prop_type_inspirations";
    existingPairs.add(compositeKey);
    existingPairs.delete(pairKey(entry.a, entry.b, "prop_type"));
  }
}

console.log(
  dryRun
    ? `[dry-run] via_database=${viaDatabaseUpdates} normalize_prop_type=${normalizedToComposite}`
    : `Updated via_database=${viaDatabaseUpdates} normalize_prop_type=${normalizedToComposite}`,
);

if (!dryRun && (viaDatabaseUpdates > 0 || normalizedToComposite > 0)) {
  store.writeRelationshipsFile(relationshipsFile);
}
