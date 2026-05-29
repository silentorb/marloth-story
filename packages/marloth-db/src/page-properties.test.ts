import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedDynamicField } from "./dynamic-fields/overlay";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { buildPropertiesSection } from "./page-properties";
import { getRecordPageDetail } from "./record-sections";

describe("page-properties", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-page-props-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  const CHAR_DB = "f984a934ad644f8480b0f8f51449569f";
  const character = "cccccccccccccccccccccccccccccccc";
  const scene1 = "s1111111111111111111111111111111";
  const scene2 = "s2222222222222222222222222222222";

  test("includes computed dynamic fields with allViews", () => {
    db.upsertVertex(CHAR_DB, ["NotionDatabase"], { title: "Characters" });
    db.upsertVertex(character, ["NotionPage"], { title: "James" });
    db.upsertEdge(character, CHAR_DB, IS_A_LABEL, { row_index: 0, priority: "High" });

    db.upsertVertex(scene1, ["NotionPage"], { title: "Scene A" });
    db.upsertVertex(scene2, ["NotionPage"], { title: "Scene B" });
    db.upsertEdge(character, scene1, "SCENES", {});
    db.upsertEdge(character, scene2, "SCENES", {});

    seedDynamicField(db, {
      id: "props-all-scene",
      databaseId: CHAR_DB,
      columnKey: "all_scene_count",
      columnName: "All Scene count",
      resolverId: "characters.allSceneCount",
      docsPath: "docs/dynamic-fields/characters.all-scene-count.md",
      viewNames: ["Hidden View"],
    });

    const properties = buildPropertiesSection(db, character);
    expect(properties).toMatchObject({
      databaseId: CHAR_DB,
      typeTitle: "Characters",
      cells: {
        priority: "High",
        all_scene_count: "2",
      },
    });
    expect(properties?.columnDefs?.some((col) => col.key === "all_scene_count")).toBe(true);
    expect(
      properties?.columnDefs?.find((col) => col.key === "all_scene_count")?.source,
    ).toBe("dynamic");
  });

  test("getRecordPageDetail exposes properties and omits IS_A relation section", () => {
    const detail = getRecordPageDetail(db, character);
    expect(detail?.properties?.cells.all_scene_count).toBe("2");
    expect(
      detail?.sections.some(
        (section) => section.type === "relations" && section.label === IS_A_LABEL,
      ),
    ).toBe(false);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
