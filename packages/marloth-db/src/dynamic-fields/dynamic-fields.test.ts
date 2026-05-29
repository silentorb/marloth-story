import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "../graph";
import { IS_A_LABEL } from "../labels";
import { getDatabaseViewDetail } from "../database-view";
import {
  seedDynamicColumnSet,
  seedDynamicField,
} from "./overlay";
import {
  buildAllSceneCountPrefetch,
  buildSceneCountByProductPrefetch,
  buildWeightedUsePrefetch,
  buildWonderPrefetch,
  resolveAllSceneCount,
  resolveSceneCountByProduct,
  resolveWeightedUse,
  resolveWonder,
} from "./resolvers/index";

describe("dynamic-fields resolvers", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-df-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  const CHAR_DB = "f984a934ad644f8480b0f8f51449569f";
  const INSP_DB = "2eea538996934ce8abafc27132e576c1";
  const FEAT_DB = "dd0de9867cc345b898929306bdf9fc83";
  const TWOLD = "e028aa0786f5449984a4f497c1d746fa";
  const OTHER_PRODUCT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const WONDERLAND = "3cbc40d2ba2a4c76b4b9dc370452fcfe";

  const character = "cccccccccccccccccccccccccccccccc";
  const scene1 = "s1111111111111111111111111111111";
  const scene2 = "s2222222222222222222222222222222";
  const scene3 = "s3333333333333333333333333333333";
  const inspiration = "iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii";
  const featureWonder = "fwffffffffffffffffffffffffffffff";
  const featurePlain = "fpffffffffffffffffffffffffffffff";

  beforeAll(() => {
    db.upsertVertex(CHAR_DB, ["NotionDatabase"], { title: "Characters" });
    db.upsertVertex(INSP_DB, ["NotionDatabase"], { title: "Inspirations" });
    db.upsertVertex(FEAT_DB, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex(TWOLD, ["NotionPage"], { title: "TWOLD" });
    db.upsertVertex(OTHER_PRODUCT, ["NotionPage"], { title: "Other Book" });
    db.upsertVertex(WONDERLAND, ["NotionPage"], { title: "Wonderland" });

    db.upsertVertex(character, ["NotionPage"], { title: "James" });
    db.upsertEdge(character, CHAR_DB, IS_A_LABEL, { row_index: 0 });

    db.upsertVertex(scene1, ["NotionPage"], { title: "Scene A" });
    db.upsertVertex(scene2, ["NotionPage"], { title: "Scene B" });
    db.upsertVertex(scene3, ["NotionPage"], { title: "Scene C" });
    db.upsertEdge(character, scene1, "SCENES", {});
    db.upsertEdge(character, scene2, "SCENES", {});
    db.upsertEdge(character, scene3, "SCENES", {});
    db.upsertEdge(scene1, TWOLD, "PRODUCT", {});
    db.upsertEdge(scene2, TWOLD, "PRODUCT", {});
    db.upsertEdge(scene3, OTHER_PRODUCT, "PRODUCT", {});

    db.upsertVertex(inspiration, ["NotionPage"], { title: "Test Inspiration" });
    db.upsertEdge(inspiration, INSP_DB, IS_A_LABEL, { row_index: 0 });

    db.upsertVertex(featureWonder, ["NotionPage"], { title: "Adventure" });
    db.upsertVertex(featurePlain, ["NotionPage"], { title: "Plain" });
    db.upsertEdge(featureWonder, FEAT_DB, IS_A_LABEL, { priority: "Medium" });
    db.upsertEdge(featurePlain, FEAT_DB, IS_A_LABEL, { priority: "High" });
    db.upsertEdge(inspiration, featureWonder, "FEATURES", {});
    db.upsertEdge(inspiration, featurePlain, "FEATURES", {});
    db.upsertEdge(featureWonder, WONDERLAND, "THEME", {});

    seedDynamicField(db, {
      id: "test-all-scene",
      databaseId: CHAR_DB,
      columnKey: "all_scene_count",
      columnName: "All Scene count",
      resolverId: "characters.allSceneCount",
      docsPath: "docs/dynamic-fields/characters.all-scene-count.md",
    });
    seedDynamicColumnSet(db, {
      id: "test-scene-by-product",
      databaseId: CHAR_DB,
      columnKeyPattern: "scene_count__{productId}",
      columnNamePattern: "{productTitle} Scene count",
      resolverId: "characters.sceneCountByProduct",
      docsPath: "docs/dynamic-fields/characters.scene-count-by-product.md",
      params: { hide_legacy_keys: ["twold_scene_count"] },
    });
    seedDynamicField(db, {
      id: "test-weighted-use",
      databaseId: INSP_DB,
      columnKey: "weighted_use",
      columnName: "Weighted Use",
      resolverId: "inspirations.weightedUse",
      docsPath: "docs/dynamic-fields/inspirations.weighted-use.md",
      params: { features_database_id: FEAT_DB },
    });
    seedDynamicField(db, {
      id: "test-wonder",
      databaseId: INSP_DB,
      columnKey: "wonder",
      columnName: "Wonder",
      resolverId: "inspirations.wonder",
      docsPath: "docs/dynamic-fields/inspirations.wonder.md",
      params: { theme_target_id: WONDERLAND },
    });
  });

  test("all scene count", () => {
    const ctx = { db, databaseId: CHAR_DB, viewName: "All", rowPageIds: [character] };
    const prefetch = buildAllSceneCountPrefetch(ctx);
    expect(resolveAllSceneCount(ctx, {}, character, prefetch)).toBe("3");
  });

  test("scene count by product", () => {
    const ctx = { db, databaseId: CHAR_DB, viewName: "All", rowPageIds: [character] };
    const prefetch = buildSceneCountByProductPrefetch(ctx, {});
    expect(resolveSceneCountByProduct(ctx, {}, character, TWOLD, prefetch)).toBe("2");
    expect(resolveSceneCountByProduct(ctx, {}, character, OTHER_PRODUCT, prefetch)).toBe("1");
  });

  test("weighted use", () => {
    const ctx = { db, databaseId: INSP_DB, viewName: "Weighted", rowPageIds: [inspiration] };
    const prefetch = buildWeightedUsePrefetch(ctx, { features_database_id: FEAT_DB });
    expect(resolveWeightedUse(ctx, {}, inspiration, prefetch)).toBe("6");
  });

  test("wonder count", () => {
    const ctx = { db, databaseId: INSP_DB, viewName: "Wonder", rowPageIds: [inspiration] };
    const prefetch = buildWonderPrefetch(ctx, { theme_target_id: WONDERLAND });
    expect(resolveWonder(ctx, {}, inspiration, prefetch)).toBe("1");
  });

  test("database view integration for characters", () => {
    const detail = getDatabaseViewDetail(db, CHAR_DB);
    const james = detail?.rows.find((r) => r.pageId === character);
    expect(james?.cells.all_scene_count).toBe("3");
    expect(james?.cells[`scene_count__${TWOLD}`]).toBe("2");
    expect(james?.cells[`scene_count__${OTHER_PRODUCT}`]).toBe("1");
    expect(detail?.columnDefs?.some((c) => c.key === `scene_count__${TWOLD}`)).toBe(true);
  });

  test("database view integration for inspirations", () => {
    const detail = getDatabaseViewDetail(db, INSP_DB);
    const row = detail?.rows.find((r) => r.pageId === inspiration);
    expect(row?.cells.weighted_use).toBe("6");
    expect(row?.cells.wonder).toBe("1");
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
