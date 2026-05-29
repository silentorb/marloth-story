import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedDynamicField } from "./dynamic-fields/overlay";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { buildPropertiesSection } from "./node-type-properties";
import { getNodePageDetail } from "./node-page-sections";

describe("node-type-properties", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-page-props-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  const CHAR_DB = "f984a934ad644f8480b0f8f51449569f";
  const character = "cccccccccccccccccccccccccccccccc";
  const scene1 = "s1111111111111111111111111111111";
  const scene2 = "s2222222222222222222222222222222";

  test("includes computed dynamic fields with allViews", () => {
    db.upsertNode(CHAR_DB, ["NotionDatabase"], { title: "Characters" });
    db.upsertNode(character, ["NotionPage"], { title: "James" });
    db.upsertConnection(character, CHAR_DB, IS_A_LABEL, { row_index: 0, priority: "High" });

    db.upsertNode(scene1, ["NotionPage"], { title: "Scene A" });
    db.upsertNode(scene2, ["NotionPage"], { title: "Scene B" });
    db.upsertConnection(character, scene1, "SCENES", {});
    db.upsertConnection(character, scene2, "SCENES", {});

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

  test("getNodePageDetail exposes properties and omits IS_A relation section", () => {
    const detail = getNodePageDetail(db, character);
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
