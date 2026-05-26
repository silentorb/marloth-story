import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import {
  archivePathForRecord,
  archiveRecord,
  DEFAULT_ARCHIVE_RECORD_ID,
  deleteRecord,
} from "./record-lifecycle";
import { DEFAULT_HOME_RECORD_ID, getRecordDetail, searchRecords } from "./queries";

describe("record lifecycle", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-lifecycle-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  db.upsertVertex(DEFAULT_HOME_RECORD_ID, ["NotionPage"], {
    title: "Marloth",
    inferred_notion_path: "Marloth",
  });
  db.upsertVertex(DEFAULT_ARCHIVE_RECORD_ID, ["NotionPage"], {
    title: "Archive",
    inferred_notion_path: "Marloth",
  });
  db.upsertVertex("page-active", ["NotionPage"], {
    title: "Active Scene",
    inferred_notion_path: "Marloth/Scenes/Active Scene",
  });
  db.upsertVertex("page-archived", ["NotionPage"], {
    title: "Old Scene",
    inferred_notion_path: "Marloth/Archive/Old Scene",
  });

  test("archivePathForRecord preserves leaf segment under Archive", () => {
    expect(archivePathForRecord("Marloth/Features/Idea", "Idea")).toBe("Marloth/Archive/Idea");
    expect(archivePathForRecord(null, "Untitled note")).toBe("Marloth/Archive/Untitled note");
  });

  test("archiveRecord moves page under Archive and links to Archive node", () => {
    expect(archiveRecord(db, "page-active")).toBeNull();
    const detail = getRecordDetail(db, "page-active");
    expect(detail?.path).toBe("Marloth/Archive/Active Scene");
    expect(db.listEdgesFromSource("page-active", "PART")[0]?.targetId).toBe(DEFAULT_ARCHIVE_RECORD_ID);
  });

  test("archiveRecord rejects protected and already archived pages", () => {
    expect(archiveRecord(db, DEFAULT_HOME_RECORD_ID)).toBe("protected");
    expect(archiveRecord(db, "page-archived")).toBe("already_archived");
  });

  test("deleteRecord removes vertex and rejects protected pages", () => {
    db.upsertVertex("page-delete", ["NotionPage"], { title: "Disposable" });
    expect(deleteRecord(db, "page-delete")).toBeNull();
    expect(getRecordDetail(db, "page-delete")).toBeNull();
    expect(deleteRecord(db, DEFAULT_HOME_RECORD_ID)).toBe("protected");
  });

  test("searchRecords excludes archived pages", () => {
    const hits = searchRecords(db, "Scene", 20);
    expect(hits.some((hit) => hit.id === "page-active")).toBe(false);
    expect(hits.some((hit) => hit.id === "page-archived")).toBe(false);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
