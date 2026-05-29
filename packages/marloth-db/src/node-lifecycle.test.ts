import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import {
  archivePathForNode,
  archiveNode,
  DEFAULT_ARCHIVE_NODE_ID,
  deleteNode,
} from "./node-lifecycle";
import { DEFAULT_HOME_NODE_ID, getNodeDetail, searchNodes } from "./queries";

describe("record lifecycle", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-lifecycle-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  db.upsertNode(DEFAULT_HOME_NODE_ID, ["NotionPage"], {
    title: "Marloth",
    inferred_notion_path: "Marloth",
  });
  db.upsertNode(DEFAULT_ARCHIVE_NODE_ID, ["NotionPage"], {
    title: "Archive",
    inferred_notion_path: "Marloth",
  });
  db.upsertNode("page-active", ["NotionPage"], {
    title: "Active Scene",
    inferred_notion_path: "Marloth/Scenes/Active Scene",
  });
  db.upsertNode("page-archived", ["NotionPage"], {
    title: "Old Scene",
    inferred_notion_path: "Marloth/Archive/Old Scene",
  });

  test("archivePathForNode preserves leaf segment under Archive", () => {
    expect(archivePathForNode("Marloth/Features/Idea", "Idea")).toBe("Marloth/Archive/Idea");
    expect(archivePathForNode(null, "Untitled note")).toBe("Marloth/Archive/Untitled note");
  });

  test("archiveNode moves page under Archive and links to Archive node", () => {
    expect(archiveNode(db, "page-active")).toBeNull();
    const detail = getNodeDetail(db, "page-active");
    expect(detail?.path).toBe("Marloth/Archive/Active Scene");
    expect(db.listConnectionsFromSource("page-active", "PART")[0]?.targetNodeId).toBe(DEFAULT_ARCHIVE_NODE_ID);
  });

  test("archiveNode rejects protected and already archived pages", () => {
    expect(archiveNode(db, DEFAULT_HOME_NODE_ID)).toBe("protected");
    expect(archiveNode(db, "page-archived")).toBe("already_archived");
  });

  test("deleteNode removes vertex and rejects protected pages", () => {
    db.upsertNode("page-delete", ["NotionPage"], { title: "Disposable" });
    expect(deleteNode(db, "page-delete")).toBeNull();
    expect(getNodeDetail(db, "page-delete")).toBeNull();
    expect(deleteNode(db, DEFAULT_HOME_NODE_ID)).toBe("protected");
  });

  test("searchNodes excludes archived pages", () => {
    const hits = searchNodes(db, "Scene", 20);
    expect(hits.some((hit) => hit.id === "page-active")).toBe(false);
    expect(hits.some((hit) => hit.id === "page-archived")).toBe(false);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
