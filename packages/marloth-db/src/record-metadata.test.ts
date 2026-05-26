import { describe, expect, test } from "bun:test";
import { GraphDatabase } from "./graph";
import { getRecordPageMetadata } from "./record-metadata";
import { getRecordPageDetail } from "./record-sections";
import { updateRecordBody } from "./queries";

describe("record-metadata", () => {
  test("counts incident edges and lists backlinks", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    db.upsertVertex("page-a", ["NotionPage"], { title: "Page A" });
    db.upsertVertex("page-b", ["NotionPage"], { title: "Page B" });
    db.upsertVertex("page-c", ["NotionPage"], { title: "Page C" });
    db.upsertEdge("page-b", "page-a", "LINKS");
    db.upsertEdge("page-c", "page-a", "REFERENCES");

    const meta = getRecordPageMetadata(db, "page-a");
    expect(meta?.connectionCount).toBe(2);
    expect(meta?.backlinks).toHaveLength(2);
    expect(meta?.backlinks.map((b) => b.title).sort()).toEqual(["Page B", "Page C"]);

    db.close();
  });

  test("reads created_at and modified_at from vertex properties", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    db.upsertVertex("page-a", ["NotionPage"], {
      title: "Page A",
      created_at: "2024-01-15T10:00:00.000Z",
      modified_at: "2024-06-01T12:30:00.000Z",
    });

    const meta = getRecordPageMetadata(db, "page-a");
    expect(meta?.createdAt).toBe("2024-01-15T10:00:00.000Z");
    expect(meta?.modifiedAt).toBe("2024-06-01T12:30:00.000Z");

    db.close();
  });

  test("getRecordPageDetail includes metadata", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    db.upsertVertex("page-a", ["NotionPage"], { title: "Page A", body: "Hello" });

    const detail = getRecordPageDetail(db, "page-a");
    expect(detail?.metadata.connectionCount).toBe(0);
    expect(detail?.metadata.backlinks).toEqual([]);

    db.close();
  });

  test("updateRecordBody sets modified_at and bootstraps created_at", () => {
    const db = new GraphDatabase(":memory:", { clean: true });
    db.upsertVertex("page-a", ["NotionPage"], { title: "Page A", body: "Old" });

    updateRecordBody(db, "page-a", "New");
    const vertex = db.getVertex("page-a");
    expect(typeof vertex?.properties.modified_at).toBe("string");
    expect(typeof vertex?.properties.created_at).toBe("string");

    db.close();
  });
});
