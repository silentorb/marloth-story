#!/usr/bin/env bun
/**
 * One-shot migration: ordered membership refactor.
 * - Scenes, Parts, Products: member_of → ordered_member_of; strip row_index; Parts number → order
 * - Pacing types: strip row_index and order from member_of
 * - All other type tables: strip row_index from member_of
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCENES_DB = "01KWN86X6MFZQAJ1V36T9592EA";
const PARTS_DB = "01KWN86X6NJZMP5ZESZTNDXXZQ";
const PRODUCTS_DB = "01KWN86X6NJZMP5ZESZTNDXXYT";
const PACING_TYPES_DB = "01KWN86X6NJZMP5ZESZTNDXXYK";

const ORDERED_SETS = new Set([SCENES_DB, PARTS_DB, PRODUCTS_DB]);

const contentRoot = resolve(import.meta.dir, "../content");
const relationshipsPath = resolve(contentRoot, "data/relationships.json");

interface RelationshipEntry {
  a: string;
  b: string;
  type: string;
  properties?: Record<string, unknown>;
}

function migrateProperties(
  setId: string,
  props: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const next: Record<string, unknown> = { ...props };
  delete next.row_index;

  if (setId === PARTS_DB) {
    if (next.number !== undefined && next.order === undefined) {
      next.order = next.number;
    }
    delete next.number;
  }

  if (setId === PACING_TYPES_DB) {
    delete next.order;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

const raw = JSON.parse(readFileSync(relationshipsPath, "utf-8")) as {
  version: number;
  relationships: RelationshipEntry[];
};

let converted = 0;
let stripped = 0;

for (const entry of raw.relationships) {
  if (entry.type !== "member_of") continue;
  const setId = entry.a;
  const props = entry.properties;

  if (ORDERED_SETS.has(setId)) {
    entry.type = "ordered_member_of";
    entry.properties = migrateProperties(setId, props);
    converted += 1;
    continue;
  }

  if (!props || !("row_index" in props || "order" in props)) continue;
  entry.properties = migrateProperties(setId, props);
  stripped += 1;
}

writeFileSync(relationshipsPath, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Migrated ${converted} edges to ordered_member_of; stripped row_index/order from ${stripped} member_of edges.`);
