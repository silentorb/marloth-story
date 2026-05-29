import { resolve } from "node:path";
import { GraphDatabase, seedDynamicColumnSet, seedDynamicField } from "marloth-db";
import type { SeedDynamicColumnSetInput, SeedDynamicFieldInput } from "marloth-db";
import {
  ContentStore,
  fileFromSeedInputs,
  resolveContentPath,
} from "marloth-db/content";

const DEFAULT_DB = resolve(import.meta.dir, "../data/marloth.sqlite");

const CHARACTERS_DB = "f984a934ad644f8480b0f8f51449569f";
const INSPIRATIONS_DB = "2eea538996934ce8abafc27132e576c1";
const FEATURES_DB = "dd0de9867cc345b898929306bdf9fc83";

function dbPath(): string {
  return process.env.MARLOTH_DB_PATH ?? DEFAULT_DB;
}

export function starterDynamicFieldSeeds(): {
  fields: SeedDynamicFieldInput[];
  columnSets: SeedDynamicColumnSetInput[];
} {
  return {
    fields: [
      {
        id: "characters-all-scene-count",
        databaseId: CHARACTERS_DB,
        columnKey: "all_scene_count",
        columnName: "All Scene count",
        columnType: "number",
        resolverId: "characters.allSceneCount",
        docsPath: "docs/dynamic-fields/characters.all-scene-count.md",
      },
      {
        id: "inspirations-weighted-use",
        databaseId: INSPIRATIONS_DB,
        columnKey: "weighted_use",
        columnName: "Weighted Use",
        columnType: "number",
        resolverId: "inspirations.weightedUse",
        docsPath: "docs/dynamic-fields/inspirations.weighted-use.md",
        params: {
          features_edge_label: "FEATURES",
          features_database_id: FEATURES_DB,
        },
      },
      {
        id: "inspirations-wonder",
        databaseId: INSPIRATIONS_DB,
        columnKey: "wonder",
        columnName: "Wonder",
        columnType: "number",
        resolverId: "inspirations.wonder",
        docsPath: "docs/dynamic-fields/inspirations.wonder.md",
        params: {
          features_edge_label: "FEATURES",
          theme_edge_label: "THEME",
          theme_target_id: "3cbc40d2ba2a4c76b4b9dc370452fcfe",
        },
      },
    ],
    columnSets: [
      {
        id: "characters-scene-count-by-product",
        databaseId: CHARACTERS_DB,
        columnKeyPattern: "scene_count__{productId}",
        columnNamePattern: "{productTitle} Scene count",
        columnType: "number",
        resolverId: "characters.sceneCountByProduct",
        docsPath: "docs/dynamic-fields/characters.scene-count-by-product.md",
        params: {
          scenes_edge_label: "SCENES",
          product_edge_label: "PRODUCT",
          hide_legacy_keys: ["twold_scene_count"],
        },
      },
    ],
  };
}

export function seedStarterDynamicFields(db: GraphDatabase): void {
  const { fields, columnSets } = starterDynamicFieldSeeds();
  for (const field of fields) {
    seedDynamicField(db, field);
  }
  for (const set of columnSets) {
    seedDynamicColumnSet(db, set);
  }
}

export function seedStarterDynamicFieldsToContent(contentDir?: string): void {
  const store = new ContentStore(contentDir ?? resolveContentPath());
  const { fields, columnSets } = starterDynamicFieldSeeds();
  store.writeDynamicFieldsFile(fileFromSeedInputs(fields, columnSets));
}

if (import.meta.main) {
  seedStarterDynamicFieldsToContent();
  console.log(`Seeded starter dynamic field configuration to ${resolveContentPath()}`);
}
