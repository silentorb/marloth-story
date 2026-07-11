#!/usr/bin/env bun
/**
 * One-shot repair: feature↔inspiration edges mis-typed as features_children /
 * includes_features during migrate-named-composite-ssot.ts.
 *
 * Usage: bun scripts/repair-inspirations-features.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseRelationshipTypesFile,
  serializeRelationshipTypesFile,
} from "/workspaces/tome/packages/tome-db/src/content/relationship-types-file";
import {
  type RelationshipEntry,
  serializeRelationshipsFile,
} from "/workspaces/tome/packages/tome-db/src/content/relationships-file";

const FEATURES = "01KWN86X6NJZMP5ZESZTNDXY7W";
const INSPIRATIONS = "01KWN86X6NJZMP5ZESZTNDXXW0";
const PRODUCTS = "01KWN86X6NJZMP5ZESZTNDXXYT";
const BIBLE_PASSAGES = "01KWN86X6MFZQAJ1V36T9592H3";

/** Orphan feature-like nodes that lost Features membership. */
const ORPHAN_FEATURES = [
  "01KWN86X6NJZMP5ZESZTNDXXVB", // Heart
  "01KWN86X6NJZMP5ZESZTNDXY75", // Heart warming horror
  "01KWN86X6MFZQAJ1V36T9592AF", // Chaotic world
  "01KWN86X6MFZQAJ1V36T9592E8", // Turned tables
] as const;

const dryRun = process.argv.includes("--dry-run");
const contentRoot = resolve(import.meta.dir, "../content");
const relationshipsPath = resolve(contentRoot, "data/relationships.json");
const typesPath = resolve(contentRoot, "model/relationship-types.json");

function membersOf(relationships: RelationshipEntry[], setId: string): Set<string> {
  const out = new Set<string>();
  for (const r of relationships) {
    if (r.archived === true) continue;
    if ((r.type === "member_of" || r.type === "ordered_member_of") && r.a === setId) {
      out.add(r.b);
    }
  }
  return out;
}

function rebuild(
  entry: RelationshipEntry,
  a: string,
  b: string,
  type: string,
): RelationshipEntry {
  return {
    a,
    b,
    type,
    ...(entry.archived === true ? { archived: true } : {}),
    ...(entry.properties && Object.keys(entry.properties).length > 0
      ? { properties: entry.properties }
      : {}),
  };
}

function pairKey(type: string, a: string, b: string): string {
  return `${type}|${a}|${b}`;
}

const raw = JSON.parse(readFileSync(relationshipsPath, "utf-8")) as {
  version: number;
  relationships: RelationshipEntry[];
};

const featMembers = membersOf(raw.relationships, FEATURES);
const inspMembers = membersOf(raw.relationships, INSPIRATIONS);
const productMembers = membersOf(raw.relationships, PRODUCTS);
const bibleMembers = membersOf(raw.relationships, BIBLE_PASSAGES);

const existingKeys = new Set(
  raw.relationships
    .filter((r) => r.archived !== true)
    .map((r) => pairKey(r.type, r.a, r.b)),
);

let toInspirations = 0;
let toProducts = 0;
let toBible = 0;
let membershipAdded = 0;
let skippedDuplicate = 0;
const leftoverChildren: RelationshipEntry[] = [];
const ambiguousIncludes: RelationshipEntry[] = [];

const next: RelationshipEntry[] = [];

for (const entry of raw.relationships) {
  // --- includes_features → inspirations_features ---
  if (entry.type === "includes_features") {
    const aInsp = inspMembers.has(entry.a);
    const bInsp = inspMembers.has(entry.b);
    if (aInsp === bInsp) {
      ambiguousIncludes.push(entry);
      next.push(entry);
      continue;
    }
    const inspiration = aInsp ? entry.a : entry.b;
    const feature = aInsp ? entry.b : entry.a;
    const key = pairKey("inspirations_features", inspiration, feature);
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    existingKeys.add(key);
    next.push(rebuild(entry, inspiration, feature, "inspirations_features"));
    toInspirations += 1;
    continue;
  }

  if (entry.type !== "features_children" || entry.archived === true) {
    next.push(entry);
    continue;
  }

  const aFeat = featMembers.has(entry.a);
  const bFeat = featMembers.has(entry.b);
  const aInsp = inspMembers.has(entry.a);
  const bInsp = inspMembers.has(entry.b);
  const aProd = productMembers.has(entry.a);
  const bProd = productMembers.has(entry.b);
  const aBible = bibleMembers.has(entry.a);
  const bBible = bibleMembers.has(entry.b);

  // Features ↔ Inspirations → inspirations_features (a=inspiration, b=feature)
  if ((aFeat && bInsp) || (aInsp && bFeat)) {
    const inspiration = aInsp ? entry.a : entry.b;
    const feature = aFeat ? entry.a : entry.b;
    const key = pairKey("inspirations_features", inspiration, feature);
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    existingKeys.add(key);
    next.push(rebuild(entry, inspiration, feature, "inspirations_features"));
    toInspirations += 1;
    continue;
  }

  // Feature ↔ Product → products_features (a=product, b=feature)
  if ((aFeat && bProd) || (aProd && bFeat)) {
    const product = aProd ? entry.a : entry.b;
    const feature = aFeat ? entry.a : entry.b;
    const key = pairKey("products_features", product, feature);
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    existingKeys.add(key);
    next.push(rebuild(entry, product, feature, "products_features"));
    toProducts += 1;
    continue;
  }

  // Feature ↔ Bible passage → features_bible_passages (a=feature, b=bible)
  if ((aFeat && bBible) || (aBible && bFeat)) {
    const feature = aFeat ? entry.a : entry.b;
    const bible = aBible ? entry.a : entry.b;
    const key = pairKey("features_bible_passages", feature, bible);
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    existingKeys.add(key);
    next.push(rebuild(entry, feature, bible, "features_bible_passages"));
    toBible += 1;
    continue;
  }

  leftoverChildren.push(entry);
  next.push(entry);
}

// Restore Features membership for orphan feature-like nodes
for (const nodeId of ORPHAN_FEATURES) {
  if (featMembers.has(nodeId)) continue;
  const key = pairKey("member_of", FEATURES, nodeId);
  if (existingKeys.has(key)) continue;
  next.push({ a: FEATURES, b: nodeId, type: "member_of" });
  existingKeys.add(key);
  featMembers.add(nodeId);
  membershipAdded += 1;
}

raw.relationships = next;

const typesFile = parseRelationshipTypesFile(readFileSync(typesPath, "utf-8"));
const hadIncludesFeatures = "includes_features" in typesFile.types;
if (hadIncludesFeatures) {
  delete typesFile.types.includes_features;
}

console.log(
  JSON.stringify(
    {
      dryRun,
      toInspirations,
      toProducts,
      toBible,
      membershipAdded,
      skippedDuplicate,
      leftoverFeaturesChildren: leftoverChildren.length,
      ambiguousIncludes: ambiguousIncludes.length,
      removedIncludesFeaturesType: hadIncludesFeatures,
      leftoverSamples: leftoverChildren.slice(0, 20).map((r) => ({
        a: r.a,
        b: r.b,
      })),
    },
    null,
    2,
  ),
);

if (!dryRun) {
  writeFileSync(relationshipsPath, serializeRelationshipsFile(raw));
  writeFileSync(typesPath, serializeRelationshipTypesFile(typesFile));
  console.log("Wrote relationships.json and relationship-types.json");
}
