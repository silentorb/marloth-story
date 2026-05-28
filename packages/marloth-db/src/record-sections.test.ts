import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { getRecordPageDetail } from "./record-sections";

describe("record-sections", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-sections-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  test("returns markdown as the first section", () => {
    db.upsertVertex("page1", ["NotionPage"], {
      title: "Alpha",
      body: "# Notes",
    });

    const detail = getRecordPageDetail(db, "page1");
    expect(detail?.sections[0]).toEqual({ type: "markdown", body: "# Notes" });
  });

  test("adds relation sections grouped by edge label with edge properties as columns", () => {
    db.upsertVertex("scene1", ["NotionPage"], { title: "Opening", body: "" });
    db.upsertVertex("feat1", ["NotionPage"], {
      title: "Desperation",
      inferred_notion_path: "Marloth/Features/Desperation.md",
    });
    db.upsertVertex("insp1", ["NotionPage"], { title: "Pride and Prejudice" });
    db.upsertEdge("scene1", "feat1", "FEATURES", { ordinal: 0, weight: "strong" });
    db.upsertEdge("scene1", "insp1", "INSPIRATIONS", { ordinal: 1 });

    const detail = getRecordPageDetail(db, "scene1");
    const relationSections = detail?.sections.filter((section) => section.type === "relations");

    expect(relationSections).toHaveLength(2);
    expect(relationSections?.[0]).toMatchObject({
      type: "relations",
      label: "FEATURES",
      title: "Features",
      columns: ["weight"],
      rows: [
        {
          targetId: "feat1",
          name: "Desperation",
          path: "Marloth/Features/Desperation.md",
          cells: { weight: "strong" },
        },
      ],
    });
    expect(relationSections?.[1]).toMatchObject({
      label: "INSPIRATIONS",
      rows: [{ targetId: "insp1", name: "Pride and Prejudice" }],
    });
  });

  test("adds database table section for NotionDatabase records after markdown", () => {
    const databaseId = "db42345678901234567890123456789012";
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Features DB", body: "# About" });
    db.upsertVertex("page4", ["NotionPage"], { title: "Guest consultant" });
    db.upsertEdge("page4", databaseId, IS_A_LABEL, {
      view: "default",
      row_index: 0,
      status: "Active",
    });

    const detail = getRecordPageDetail(db, databaseId);
    expect(detail?.properties).toBeNull();
    expect(detail?.sections.map((section) => section.type)).toEqual(["markdown", "database"]);
    expect(detail?.sections[1]).toMatchObject({
      type: "database",
      databaseView: {
        title: "Features DB",
        rows: [{ pageId: "page4", name: "Guest consultant", cells: { status: "Active" } }],
      },
    });
  });

  test("returns null properties when page has no type membership", () => {
    db.upsertVertex("page-no-type", ["NotionPage"], { title: "Orphan", body: "" });
    const detail = getRecordPageDetail(db, "page-no-type");
    expect(detail?.properties).toBeNull();
  });

  test("shows Properties section for IS_A edge scalars and hides IS_A relation section", () => {
    const databaseId = "db52345678901234567890123456789012";
    db.upsertVertex("page5", ["NotionPage"], { title: "Scene A", body: "Prose" });
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Scene Archive" });
    db.upsertEdge("page5", databaseId, IS_A_LABEL, {
      view: "default",
      row_index: 3,
      priority: "High",
    });

    const detail = getRecordPageDetail(db, "page5");
    const membership = detail?.sections.find(
      (section) => section.type === "relations" && section.label === IS_A_LABEL,
    );

    expect(membership).toBeUndefined();
    expect(detail?.properties).toMatchObject({
      type: "properties",
      databaseId,
      typeTitle: "Scene Archive",
      columns: ["priority"],
      columnDefs: [
        {
          key: "priority",
          name: "Priority",
          type: "enum",
          enumId: "priority",
        },
      ],
      cells: { priority: "High" },
    });
  });

  test("normalizes legacy IN_DATABASE edges into Properties section", () => {
    const databaseId = "db62345678901234567890123456789012";
    db.upsertVertex("page6", ["NotionPage"], { title: "Legacy row" });
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Legacy Features" });
    db.upsertEdge("page6", databaseId, "IN_DATABASE", { status: "Draft" });

    const detail = getRecordPageDetail(db, "page6");
    const membership = detail?.sections.find(
      (section) => section.type === "relations" && section.label === IS_A_LABEL,
    );

    expect(membership).toBeUndefined();
    expect(detail?.properties).toMatchObject({
      databaseId,
      typeTitle: "Legacy Features",
      cells: { status: "Draft" },
    });
  });

  test("resolves typeRecordId by matching FEATURES label to NotionDatabase title", () => {
    const featuresTypeId = "db72345678901234567890123456789012";
    db.upsertVertex("scene2", ["NotionPage"], { title: "Chase" });
    db.upsertVertex(featuresTypeId, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex("feat2", ["NotionPage"], { title: "Desperation" });
    db.upsertEdge("scene2", "feat2", "FEATURES", { ordinal: 0 });

    const detail = getRecordPageDetail(db, "scene2");
    const features = detail?.sections.find(
      (section) => section.type === "relations" && section.label === "FEATURES",
    );

    expect(features).toMatchObject({
      title: "Features",
      typeRecordId: featuresTypeId,
    });
  });

  test("ignores via_database on non-IS_A edges when resolving typeRecordId", () => {
    const featuresTypeId = "db92345678901234567890123456789012";
    const inspirationsTypeId = "db82345678901234567890123456789012";
    db.upsertVertex("scene4", ["NotionPage"], { title: "Storm" });
    db.upsertVertex(featuresTypeId, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex(inspirationsTypeId, ["NotionDatabase"], { title: "Inspirations" });
    db.upsertVertex("insp3", ["NotionPage"], { title: "Emma" });
    db.upsertEdge("scene4", "insp3", "INSPIRATIONS", {
      ordinal: 0,
      via_database: featuresTypeId,
    });

    const detail = getRecordPageDetail(db, "scene4");
    const inspirations = detail?.sections.find(
      (section) => section.type === "relations" && section.label === "INSPIRATIONS",
    );

    expect(inspirations).toMatchObject({
      title: "Inspirations",
      typeRecordId: inspirationsTypeId,
    });
  });

  test("resolves typeRecordId by matching NotionDatabase title to relation label", () => {
    const inspTypeId = "db82345678901234567890123456789012";
    db.upsertVertex("scene3", ["NotionPage"], { title: "Ball" });
    db.upsertVertex(inspTypeId, ["NotionDatabase"], { title: "Inspirations" });
    db.upsertVertex("insp2", ["NotionPage"], { title: "Emma" });
    db.upsertEdge("scene3", "insp2", "INSPIRATIONS", { ordinal: 0 });

    const detail = getRecordPageDetail(db, "scene3");
    const inspirations = detail?.sections.find(
      (section) => section.type === "relations" && section.label === "INSPIRATIONS",
    );

    expect(inspirations?.typeRecordId).toBe(inspTypeId);
    expect(inspirations?.title).toBe("Inspirations");
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
