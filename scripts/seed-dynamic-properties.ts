import { GraphDatabase, seedDynamicColumnSet, seedDynamicProperty } from "tome-db";
import type { SeedDynamicColumnSetInput, SeedDynamicPropertyInput } from "tome-db";
import {
  ContentStore,
  fileFromSeedInputs,
  resolveContentPath,
} from "tome-db/content";

/** Live Marloth type-table / set node ids. */
const CHARACTERS_OWNER = "01KWN86X6PZXQP43T36924KCTB";
const INSPIRATIONS_OWNER = "01KWN86X6NJZMP5ZESZTNDXXW0";
const FEATURES_TABLE = "01KWN86X6NJZMP5ZESZTNDXY7W";
const SCENES_TABLE = "01KWN86X6MFZQAJ1V36T9592EA";
const PRODUCTS_TABLE = "01KWN86X6NJZMP5ZESZTNDXXYT";
const WONDERLAND = "01KWN86X6NJZMP5ZESZTNDXXXN";

const CHARACTERS_SCENE_COMPOSITE = "01KXBNPNJDENZ9BXN5BYZ7JKQ8";
const SCENE_PRODUCT_COMPOSITE = "01KXBNPNJDENZ9BXN5BYZ7JKQD";
const INSPIRATION_FEATURE_COMPOSITE = "01KXBNPNJDENZ9BXN5BYZ7JKPR";
const THEME_EDGE = "01KXBNPNJDENZ9BXN5BYZ7JKQP:0";

export function starterDynamicPropertySeeds(): {
  properties: SeedDynamicPropertyInput[];
  columnSets: SeedDynamicColumnSetInput[];
} {
  return {
    properties: [
      {
        id: "01KXF8TE7E9698GQ0VQCSTFJFV",
        owner: CHARACTERS_OWNER,
        columnKey: "all_scene_count",
        columnName: "All Scene count",
        columnType: "number",
        resolverId: "characters.allSceneCount",
        params: {
          characters_scene_composite: CHARACTERS_SCENE_COMPOSITE,
          scenes_edge_label: `${CHARACTERS_SCENE_COMPOSITE}:0`,
          scenes_table_id: SCENES_TABLE,
        },
      },
      {
        id: "01KXF8TE6YH12XF803JS5W4677",
        owner: INSPIRATIONS_OWNER,
        columnKey: "weighted_use",
        columnName: "Weighted Use",
        columnType: "number",
        resolverId: "inspirations.weightedUse",
        params: {
          inspiration_feature_composite: INSPIRATION_FEATURE_COMPOSITE,
          features_edge_label: `${INSPIRATION_FEATURE_COMPOSITE}:0`,
          features_table_id: FEATURES_TABLE,
        },
      },
      {
        id: "01KXF8TE7E7S1CSX1CMJPZ8S8Z",
        owner: INSPIRATIONS_OWNER,
        columnKey: "wonder",
        columnName: "Wonder",
        columnType: "number",
        resolverId: "inspirations.wonder",
        params: {
          inspiration_feature_composite: INSPIRATION_FEATURE_COMPOSITE,
          features_edge_label: `${INSPIRATION_FEATURE_COMPOSITE}:0`,
          theme_edge_label: THEME_EDGE,
          theme_target_id: WONDERLAND,
        },
      },
    ],
    columnSets: [
      {
        id: "01KXF8TE7F0AXD7EHRVYTEBP5T",
        owner: CHARACTERS_OWNER,
        columnKeyPattern: "scene_count__{productId}",
        columnNamePattern: "{productTitle} Scene count",
        columnType: "number",
        resolverId: "characters.sceneCountByProduct",
        params: {
          characters_scene_composite: CHARACTERS_SCENE_COMPOSITE,
          scene_product_composite: SCENE_PRODUCT_COMPOSITE,
          scenes_edge_label: `${CHARACTERS_SCENE_COMPOSITE}:0`,
          product_edge_label: `${SCENE_PRODUCT_COMPOSITE}:1`,
          scenes_table_id: SCENES_TABLE,
          products_table_id: PRODUCTS_TABLE,
          hide_legacy_keys: ["twold_scene_count"],
        },
      },
    ],
  };
}

export function seedStarterDynamicProperties(db: GraphDatabase): void {
  const { properties, columnSets } = starterDynamicPropertySeeds();
  for (const property of properties) {
    seedDynamicProperty(db, property);
  }
  for (const set of columnSets) {
    seedDynamicColumnSet(db, set);
  }
}

export function seedStarterDynamicPropertiesToContent(contentDir?: string): void {
  const store = new ContentStore(contentDir ?? resolveContentPath());
  const { properties, columnSets } = starterDynamicPropertySeeds();
  store.writeDynamicPropertiesFile(fileFromSeedInputs(properties, columnSets));
}

if (import.meta.main) {
  seedStarterDynamicPropertiesToContent();
  console.log(`Seeded starter dynamic property configuration to ${resolveContentPath()}`);
}
