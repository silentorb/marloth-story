import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { GraphDatabase } from "./graph";

describe("GraphDatabase", () => {
  let tempDir: string;
  let dbPath: string;

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("upserts vertices, labels, and edges", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-db-test-"));
    dbPath = join(tempDir, "test.sqlite");
    const db = new GraphDatabase(dbPath);
    db.upsertVertex("abc123", ["Page"], { title: "Hello" });
    db.upsertVertex("def456", ["Page"], { title: "World" });
    db.upsertEdge("abc123", "def456", "LINKS_TO", { ordinal: 0 });
    db.finalize();
    db.close();

    const db2 = new GraphDatabase(dbPath);
    const v = db2.getVertex("abc123");
    expect(v?.labels).toEqual(["Page"]);
    expect(v?.properties.title).toBe("Hello");
    const e = db2.getEdge("abc123:LINKS_TO:def456");
    expect(e?.targetId).toBe("def456");
    expect(db2.counts()).toEqual({ vertices: 2, edges: 1 });
    db2.close();
  });

  test("merges vertex properties on upsert", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-db-test-"));
    dbPath = join(tempDir, "merge.sqlite");
    const db = new GraphDatabase(dbPath);
    db.upsertVertex("page1", ["Page"], { title: "A" });
    db.upsertVertex("page1", ["Page", "NotionPage"], { body: "text" });
    const v = db.getVertex("page1");
    expect(v?.labels.sort()).toEqual(["NotionPage", "Page"]);
    expect(v?.properties).toEqual({ title: "A", body: "text" });
    db.close();
  });
});
