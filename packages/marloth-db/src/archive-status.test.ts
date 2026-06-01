import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ARCHIVE_NODE_ID,
  isArchivedNode,
  isLegacyArchivedNotionPath,
} from "./archive-status";
import { GraphDatabase } from "./graph";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("archive-status", () => {
  test("isLegacyArchivedNotionPath matches archive root and nested pages", () => {
    expect(isLegacyArchivedNotionPath("Marloth/Archive")).toBe(true);
    expect(isLegacyArchivedNotionPath("Marloth/Archive/Foils/old")).toBe(true);
    expect(isLegacyArchivedNotionPath("Marloth/Scenes/active")).toBe(false);
    expect(isLegacyArchivedNotionPath(null)).toBe(false);
  });

  test("isArchivedNode uses includes edge to Archive hub", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "marloth-archive-status-"));
    const dbPath = join(tempDir, "test.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertNode("active", { title: "Active" });
    db.upsertNode("archived", { title: "Archived member" });
    db.upsertNode(DEFAULT_ARCHIVE_NODE_ID, { title: "Archive" });
    db.upsertRelationship(DEFAULT_ARCHIVE_NODE_ID, "archived", "includes");
    db.recomputeArchivedFlags(DEFAULT_ARCHIVE_NODE_ID);

    expect(isArchivedNode(db, "archived")).toBe(true);
    expect(isArchivedNode(db, "active")).toBe(false);
    expect(isArchivedNode(db, DEFAULT_ARCHIVE_NODE_ID)).toBe(false);

    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
