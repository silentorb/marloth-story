import { describe, expect, test, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";

describe("GraphDatabase enum cache encoding", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-enum-cache-"));
  const dbPath = join(dir, "test.sqlite");

  test("stores enum indices in SQLite and returns labels via API", () => {
    const db = new GraphDatabase(dbPath, { clean: true });
    const recordId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:is_a";

    db.upsertRelationshipRecord(
      {
        id: recordId,
        nodeA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nodeB: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        compositeType: "is_a",
        properties: { priority: "High", row_index: 4 },
      },
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    const record = db.getRelationshipRecord(recordId);
    expect(record?.properties.priority).toBe("High");
    expect(record?.properties.row_index).toBe(4);

    const rawDb = new Database(dbPath);
    const raw = rawDb
      .prepare("SELECT properties FROM relationship_records WHERE id = ?")
      .get(recordId) as { properties: string };
    rawDb.close();

    const stored = JSON.parse(raw.properties) as Record<string, unknown>;
    expect(stored.priority).toBe(2);
    expect(stored.row_index).toBe(4);

    db.close();
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});
