import { describe, expect, test } from "bun:test";
import { GraphDatabase } from "./graph";
import { IS_A_LABEL } from "./labels";
import { updateDatabaseRowProperty, updateOutgoingConnectionProperty } from "./connection-property-update";

describe("connection-property-update", () => {
  test("updates priority on database membership edge", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const databaseId = "dddddddddddddddddddddddddddddddd";
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    db.upsertNode(databaseId, ["NotionDatabase"], { title: "Features" });
    db.upsertNode(pageId, ["NotionPage"], { title: "Feature A" });
    db.upsertConnection(pageId, databaseId, IS_A_LABEL, { priority: "Low" });

    expect(updateDatabaseRowProperty(db, databaseId, pageId, "priority", "High")).toBeNull();

    const edge = db.listConnectionsFromSource(pageId, IS_A_LABEL)[0];
    expect(edge?.properties.priority).toBe("High");
    db.close();
  });

  test("coerces empty priority to Low", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const targetId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    db.upsertNode(pageId, ["NotionPage"], { title: "A" });
    db.upsertNode(targetId, ["NotionPage"], { title: "B" });
    db.upsertConnection(pageId, targetId, "RELATED", { priority: "High" });

    expect(updateOutgoingConnectionProperty(db, pageId, targetId, "RELATED", "priority", "")).toBeNull();
    const edge = db.listConnectionsFromSource(pageId, "RELATED")[0];
    expect(edge?.properties.priority).toBe("Low");
    db.close();
  });

  test("rejects invalid priority values", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    const pageId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const targetId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    db.upsertNode(pageId, ["NotionPage"], { title: "A" });
    db.upsertNode(targetId, ["NotionPage"], { title: "B" });
    db.upsertConnection(pageId, targetId, "RELATED", {});

    expect(updateOutgoingConnectionProperty(db, pageId, targetId, "RELATED", "priority", "4")).toBe(
      "invalid_value",
    );
    db.close();
  });
});
