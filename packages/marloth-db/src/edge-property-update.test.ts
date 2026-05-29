import { describe, expect, test } from "bun:test";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { updateDatabaseRowProperty, updateOutgoingEdgeProperty } from "./edge-property-update";

describe("edge-property-update", () => {
  test("updates priority on database membership edge", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const databaseId = "dddddddddddddddddddddddddddddddd";
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    db.upsertVertex(databaseId, ["NotionDatabase"], { title: "Features" });
    db.upsertVertex(pageId, ["NotionPage"], { title: "Feature A" });
    db.upsertEdge(pageId, databaseId, IS_A_LABEL, { priority: "Low" });

    expect(updateDatabaseRowProperty(db, databaseId, pageId, "priority", "High")).toBeNull();

    const edge = db.listEdgesFromSource(pageId, IS_A_LABEL)[0];
    expect(edge?.properties.priority).toBe("High");
    db.close();
  });

  test("coerces empty priority to Low", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const targetId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    db.upsertVertex(pageId, ["NotionPage"], { title: "A" });
    db.upsertVertex(targetId, ["NotionPage"], { title: "B" });
    db.upsertEdge(pageId, targetId, "RELATED", { priority: "High" });

    expect(updateOutgoingEdgeProperty(db, pageId, targetId, "RELATED", "priority", "")).toBeNull();
    const edge = db.listEdgesFromSource(pageId, "RELATED")[0];
    expect(edge?.properties.priority).toBe("Low");
    db.close();
  });

  test("rejects invalid priority values", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const targetId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    db.upsertVertex(pageId, ["NotionPage"], { title: "A" });
    db.upsertVertex(targetId, ["NotionPage"], { title: "B" });
    db.upsertEdge(pageId, targetId, "RELATED", {});

    expect(updateOutgoingEdgeProperty(db, pageId, targetId, "RELATED", "priority", "4")).toBe(
      "invalid_value",
    );
    db.close();
  });
});
