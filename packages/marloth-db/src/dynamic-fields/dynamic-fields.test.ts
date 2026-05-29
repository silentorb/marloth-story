import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ContentStore } from "../content/store";
import { fileFromSeedInputs } from "../content/dynamic-fields-file";
import { invalidateDynamicFieldsCache } from "../content/sync";
import { GraphDatabase } from "../graph";
import { typeTableMarkerProperties } from "../node-capabilities";
import { IS_A_LABEL } from "../labels";
import { getDatabaseViewDetail } from "../database-view";
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
  const scene1 = "11111111111111111111111111111111";
  const scene2 = "22222222222222222222222222222222";
  const scene3 = "33333333333333333333333333333333";
  const inspiration = "44444444444444444444444444444444";
  const featureWonder = "55555555555555555555555555555555";
  const featurePlain = "66666666666666666666666666666666";

  beforeAll(() => {
    const contentDir = join(dir, "content");
    mkdirSync(contentDir, { recursive: true });
    process.env.MARLOTH_CONTENT_PATH = contentDir;
    const store = new ContentStore(contentDir);
    store.writeDynamicFieldsFile(
      fileFromSeedInputs(
        [
          {
            id: "test-all-scene",
            databaseId: CHAR_DB,
            columnKey: "all_scene_count",
            columnName: "All Scene count",
            resolverId: "characters.allSceneCount",
            docsPath: "docs/dynamic-fields/characters.all-scene-count.md",
          },
          {
            id: "test-weighted-use",
            databaseId: INSP_DB,
            columnKey: "weighted_use",
            columnName: "Weighted Use",
            resolverId: "inspirations.weightedUse",
            docsPath: "docs/dynamic-fields/inspirations.weighted-use.md",
            params: { features_database_id: FEAT_DB },
          },
          {
            id: "test-wonder",
            databaseId: INSP_DB,
            columnKey: "wonder",
            columnName: "Wonder",
            resolverId: "inspirations.wonder",
            docsPath: "docs/dynamic-fields/inspirations.wonder.md",
            params: { theme_target_id: WONDERLAND },
          },
        ],
        [
          {
            id: "test-scene-by-product",
            databaseId: CHAR_DB,
            columnKeyPattern: "scene_count__{productId}",
            columnNamePattern: "{productTitle} Scene count",
            resolverId: "characters.sceneCountByProduct",
            docsPath: "docs/dynamic-fields/characters.scene-count-by-product.md",
            params: { hide_legacy_keys: ["twold_scene_count"] },
          },
        ],
      ),
    );
    invalidateDynamicFieldsCache();
    db.upsertNode(CHAR_DB, { ...typeTableMarkerProperties("Characters") });
    db.upsertNode(INSP_DB, { ...typeTableMarkerProperties("Inspirations") });
    db.upsertNode(FEAT_DB, { ...typeTableMarkerProperties("Features") });
    db.upsertNode(TWOLD, { title: "TWOLD" });
    db.upsertNode(OTHER_PRODUCT, { title: "Other Book" });
    db.upsertNode(WONDERLAND, { title: "Wonderland" });

    db.upsertNode(character, { title: "James" });
    db.upsertRelationship(character, CHAR_DB, IS_A_LABEL, { row_index: 0 });

    db.upsertNode(scene1, { title: "Scene A" });
    db.upsertNode(scene2, { title: "Scene B" });
    db.upsertNode(scene3, { title: "Scene C" });
    db.upsertRelationship(character, scene1, "SCENES", {});
    db.upsertRelationship(character, scene2, "SCENES", {});
    db.upsertRelationship(character, scene3, "SCENES", {});
    db.upsertRelationship(scene1, TWOLD, "PRODUCT", {});
    db.upsertRelationship(scene2, TWOLD, "PRODUCT", {});
    db.upsertRelationship(scene3, OTHER_PRODUCT, "PRODUCT", {});

    db.upsertNode(inspiration, { title: "Test Inspiration" });
    db.upsertRelationship(inspiration, INSP_DB, IS_A_LABEL, { row_index: 0 });

    db.upsertNode(featureWonder, { title: "Adventure" });
    db.upsertNode(featurePlain, { title: "Plain" });
    db.upsertRelationship(featureWonder, FEAT_DB, IS_A_LABEL, { priority: "Medium" });
    db.upsertRelationship(featurePlain, FEAT_DB, IS_A_LABEL, { priority: "High" });
    db.upsertRelationship(inspiration, featureWonder, "FEATURES", {});
    db.upsertRelationship(inspiration, featurePlain, "FEATURES", {});
    db.upsertRelationship(featureWonder, WONDERLAND, "THEME", {});

  });

  test("all scene count", () => {
    const ctx = { db, databaseId: CHAR_DB, viewName: "All", rowNodeIds: [character] };
    const prefetch = buildAllSceneCountPrefetch(ctx);
    expect(resolveAllSceneCount(ctx, {}, character, prefetch)).toBe("3");
  });

  test("scene count by product", () => {
    const ctx = { db, databaseId: CHAR_DB, viewName: "All", rowNodeIds: [character] };
    const prefetch = buildSceneCountByProductPrefetch(ctx, {});
    expect(resolveSceneCountByProduct(ctx, {}, character, TWOLD, prefetch)).toBe("2");
    expect(resolveSceneCountByProduct(ctx, {}, character, OTHER_PRODUCT, prefetch)).toBe("1");
  });

  test("weighted use", () => {
    const ctx = { db, databaseId: INSP_DB, viewName: "Weighted", rowNodeIds: [inspiration] };
    const prefetch = buildWeightedUsePrefetch(ctx, { features_database_id: FEAT_DB });
    expect(resolveWeightedUse(ctx, {}, inspiration, prefetch)).toBe("6");
  });

  test("wonder count", () => {
    const ctx = { db, databaseId: INSP_DB, viewName: "Wonder", rowNodeIds: [inspiration] };
    const prefetch = buildWonderPrefetch(ctx, { theme_target_id: WONDERLAND });
    expect(resolveWonder(ctx, {}, inspiration, prefetch)).toBe("1");
  });

  test("database view integration for characters", () => {
    const detail = getDatabaseViewDetail(db, CHAR_DB);
    const james = detail?.rows.find((r) => r.nodeId === character);
    expect(james?.cells.all_scene_count).toBe("3");
    expect(james?.cells[`scene_count__${TWOLD}`]).toBe("2");
    expect(james?.cells[`scene_count__${OTHER_PRODUCT}`]).toBe("1");
    expect(detail?.columnDefs?.some((c) => c.key === `scene_count__${TWOLD}`)).toBe(true);
  });

  test("database view integration for inspirations", () => {
    const detail = getDatabaseViewDetail(db, INSP_DB);
    const row = detail?.rows.find((r) => r.nodeId === inspiration);
    expect(row?.cells.weighted_use).toBe("6");
    expect(row?.cells.wonder).toBe("1");
  });

  afterAll(() => {
    delete process.env.MARLOTH_CONTENT_PATH;
    invalidateDynamicFieldsCache();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
