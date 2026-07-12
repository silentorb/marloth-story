#!/usr/bin/env bun
/**
 * One-shot repair: cross-type edges mis-typed as same-type _children /
 * parents_children during migrate-named-composite-ssot.ts, plus orphan
 * Features membership and new solutions_inspirations / solutions_bible_passages.
 *
 * Usage: bun scripts/repair-mis-typed-composites.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type RelationshipEntry,
  serializeRelationshipsFile,
} from "/workspaces/tome/packages/tome-flatfile/src/content/relationships-file";

const FEATURES = "01KWN86X6NJZMP5ZESZTNDXY7W";
const SOLUTIONS = "01KWN86X6NJZMP5ZESZTNDXXYZ";
const INSPIRATIONS = "01KWN86X6NJZMP5ZESZTNDXXW0";
const PRODUCTS = "01KWN86X6NJZMP5ZESZTNDXXYT";
const SCENES = "01KWN86X6MFZQAJ1V36T9592EA";
const LOCATIONS = "01KWN86X6NJZMP5ZESZTNDXY7Z";
const THEMES = "01KWN86X6NJZMP5ZESZTNDXY0N";
const GROUPS = "01KWN86X6NJZMP5ZESZTNDXY3J";
const CHARACTERS = "01KWN86X6PZXQP43T36924KCTB";
const BIBLE = "01KWN86X6MFZQAJ1V36T9592H3";

/** Orphan feature-like nodes that lost Features membership. */
const ORPHAN_FEATURES = [
  "01KWN86X6NJZMP5ZESZTNDXXXN", // Wonderland
  "01KWN86X6MFZQAJ1V36T959287", // Family having fun together
] as const;

/** Orphan solution-like nodes that lost Solutions membership. */
const ORPHAN_SOLUTIONS = [
  "01KWN86X6NJZMP5ZESZTNDXY2A", // James looking like a transcendent robot
] as const;

const dryRun = process.argv.includes("--dry-run");
const contentRoot = resolve(import.meta.dir, "../content");
const relationshipsPath = resolve(contentRoot, "data/relationships.json");

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

const feat = membersOf(raw.relationships, FEATURES);
const sol = membersOf(raw.relationships, SOLUTIONS);
const insp = membersOf(raw.relationships, INSPIRATIONS);
const prod = membersOf(raw.relationships, PRODUCTS);
const scene = membersOf(raw.relationships, SCENES);
const loc = membersOf(raw.relationships, LOCATIONS);
const theme = membersOf(raw.relationships, THEMES);
const group = membersOf(raw.relationships, GROUPS);
const char = membersOf(raw.relationships, CHARACTERS);
const bible = membersOf(raw.relationships, BIBLE);

const existingKeys = new Set(
  raw.relationships
    .filter((r) => r.archived !== true)
    .map((r) => pairKey(r.type, r.a, r.b)),
);

const counts: Record<string, number> = {
  membershipAdded: 0,
  skippedDuplicate: 0,
  solutions_features: 0,
  solutions_inspirations: 0,
  solutions_products: 0,
  solutions_scenes: 0,
  solutions_bible_passages: 0,
  scenes_location: 0,
  themes_includes: 0,
  groups_characters: 0,
  location_children: 0,
  solutions_children: 0,
  features_children: 0,
};

// Restore Features membership before remaps that depend on feat membership
for (const nodeId of ORPHAN_FEATURES) {
  if (feat.has(nodeId)) continue;
  const key = pairKey("member_of", FEATURES, nodeId);
  if (existingKeys.has(key)) continue;
  raw.relationships.push({ a: FEATURES, b: nodeId, type: "member_of" });
  existingKeys.add(key);
  feat.add(nodeId);
  counts.membershipAdded += 1;
}

for (const nodeId of ORPHAN_SOLUTIONS) {
  if (sol.has(nodeId)) continue;
  const key = pairKey("member_of", SOLUTIONS, nodeId);
  if (existingKeys.has(key)) continue;
  raw.relationships.push({ a: SOLUTIONS, b: nodeId, type: "member_of" });
  existingKeys.add(key);
  sol.add(nodeId);
  counts.membershipAdded += 1;
}

type Remap = {
  label: string;
  fromType: string;
  match: (a: string, b: string) => boolean;
  targetType: string;
  orient: (a: string, b: string) => [string, string];
};

const remaps: Remap[] = [
  {
    label: "solutions_features",
    fromType: "solutions_children",
    match: (a, b) => (feat.has(a) && sol.has(b)) || (sol.has(a) && feat.has(b)),
    targetType: "solutions_features",
    orient: (a, b) => (sol.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "solutions_inspirations",
    fromType: "solutions_children",
    match: (a, b) => (insp.has(a) && sol.has(b)) || (sol.has(a) && insp.has(b)),
    targetType: "solutions_inspirations",
    orient: (a, b) => (sol.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "solutions_products",
    fromType: "solutions_children",
    match: (a, b) => (prod.has(a) && sol.has(b)) || (sol.has(a) && prod.has(b)),
    targetType: "solutions_products",
    orient: (a, b) => (prod.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "solutions_scenes",
    fromType: "solutions_children",
    match: (a, b) => (scene.has(a) && sol.has(b)) || (sol.has(a) && scene.has(b)),
    targetType: "solutions_scenes",
    orient: (a, b) => (sol.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "solutions_bible_passages",
    fromType: "solutions_children",
    match: (a, b) => (bible.has(a) && sol.has(b)) || (sol.has(a) && bible.has(b)),
    targetType: "solutions_bible_passages",
    orient: (a, b) => (sol.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "scenes_location",
    fromType: "location_children",
    match: (a, b) => (scene.has(a) && loc.has(b)) || (loc.has(a) && scene.has(b)),
    targetType: "scenes_location",
    orient: (a, b) => (scene.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "themes_includes",
    fromType: "location_children",
    match: (a, b) => (theme.has(a) && loc.has(b)) || (loc.has(a) && theme.has(b)),
    targetType: "themes_includes",
    orient: (a, b) => (loc.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "groups_characters",
    fromType: "children_children",
    match: (a, b) => (group.has(a) && char.has(b)) || (char.has(a) && group.has(b)),
    targetType: "groups_characters",
    orient: (a, b) => (group.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "solutions_features",
    fromType: "parents_children",
    match: (a, b) => (feat.has(a) && sol.has(b)) || (sol.has(a) && feat.has(b)),
    targetType: "solutions_features",
    orient: (a, b) => (sol.has(a) ? [a, b] : [b, a]),
  },
  {
    label: "location_children",
    fromType: "parents_children",
    match: (a, b) => loc.has(a) && loc.has(b),
    targetType: "location_children",
    orient: (a, b) => [a, b],
  },
  {
    label: "solutions_children",
    fromType: "parents_children",
    match: (a, b) => sol.has(a) && sol.has(b),
    targetType: "solutions_children",
    orient: (a, b) => [a, b],
  },
  {
    label: "features_children",
    fromType: "parents_children",
    match: (a, b) => feat.has(a) && feat.has(b),
    targetType: "features_children",
    orient: (a, b) => [a, b],
  },
  {
    label: "themes_includes",
    fromType: "features_children",
    match: (a, b) => (theme.has(a) && loc.has(b)) || (loc.has(a) && theme.has(b)),
    targetType: "themes_includes",
    orient: (a, b) => (loc.has(a) ? [a, b] : [b, a]),
  },
];

const next: RelationshipEntry[] = [];
const leftovers: Array<{ type: string; a: string; b: string }> = [];

for (const entry of raw.relationships) {
  if (entry.archived === true) {
    next.push(entry);
    continue;
  }

  let remapped = false;
  for (const rule of remaps) {
    if (entry.type !== rule.fromType) continue;
    if (!rule.match(entry.a, entry.b)) continue;

    const [a, b] = rule.orient(entry.a, entry.b);
    const key = pairKey(rule.targetType, a, b);
    if (existingKeys.has(key) && !(entry.type === rule.targetType && entry.a === a && entry.b === b)) {
      // Duplicate of an already-present target edge — drop this mis-typed copy
      if (!(entry.type === rule.targetType && entry.a === a && entry.b === b)) {
        counts.skippedDuplicate += 1;
        remapped = true;
        break;
      }
    }
    if (entry.type === rule.targetType && entry.a === a && entry.b === b) {
      next.push(entry);
      remapped = true;
      break;
    }

    // Remove old key from set if retyping in place conceptually
    existingKeys.delete(pairKey(entry.type, entry.a, entry.b));
    existingKeys.add(key);
    next.push(rebuild(entry, a, b, rule.targetType));
    counts[rule.label] = (counts[rule.label] ?? 0) + 1;
    remapped = true;
    break;
  }

  if (!remapped) {
    next.push(entry);
    // Track unexpected leftovers in audited buckets
    if (
      entry.type === "solutions_children" ||
      entry.type === "location_children" ||
      entry.type === "features_children" ||
      entry.type === "parents_children" ||
      entry.type === "children_children"
    ) {
      const aFeat = feat.has(entry.a);
      const bFeat = feat.has(entry.b);
      const aSol = sol.has(entry.a);
      const bSol = sol.has(entry.b);
      const aLoc = loc.has(entry.a);
      const bLoc = loc.has(entry.b);
      const aGroup = group.has(entry.a);
      const bGroup = group.has(entry.b);

      // Expected leftovers: true same-type hierarchy on the correct composite
      const okSolutionsChildren = entry.type === "solutions_children" && aSol && bSol;
      const okLocationChildren = entry.type === "location_children" && aLoc && bLoc;
      const okFeaturesChildren = entry.type === "features_children" && aFeat && bFeat;
      const okParentsChildren = entry.type === "parents_children" && aGroup && bGroup;
      const okChildrenChildren = entry.type === "children_children" && aGroup && bGroup;

      if (
        !okSolutionsChildren &&
        !okLocationChildren &&
        !okFeaturesChildren &&
        !okParentsChildren &&
        !okChildrenChildren
      ) {
        leftovers.push({ type: entry.type, a: entry.a, b: entry.b });
      }
    }
  }
}

raw.relationships = next;

console.log(
  JSON.stringify(
    {
      dryRun,
      counts,
      unexpectedLeftovers: leftovers.length,
      leftoverSamples: leftovers.slice(0, 20),
    },
    null,
    2,
  ),
);

if (leftovers.length > 0) {
  console.error(`Unexpected leftovers: ${leftovers.length}`);
  if (!dryRun) {
    process.exitCode = 1;
  }
}

if (!dryRun && leftovers.length === 0) {
  writeFileSync(relationshipsPath, serializeRelationshipsFile(raw));
  console.log("Wrote relationships.json");
} else if (!dryRun && leftovers.length > 0) {
  console.error("Aborted write due to unexpected leftovers");
}
