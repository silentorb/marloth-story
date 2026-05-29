import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  exportExplorerLodGraph,
  exportFullGraph,
  isArchivedNotionPath,
} from "./graph-export";
import { DEFAULT_EXPLORER_LOD_LAYER_COUNT } from "./graph-lod-cluster";
import { GraphDatabase } from "./graph";

describe("graph export", () => {
  let tempDir: string;
  let dbPath: string;

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("exportFullGraph returns active vertices and edges", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "test.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertNode("page1", {
      title: "Scene A",
      inferred_notion_path: "Marloth/Scenes",
    });
    db.upsertNode("page2", {
      title: "Feature B",
      inferred_notion_path: "Marloth/Features",
    });
    db.upsertRelationship("page1", "page2", "FEATURES");

    const snapshot = exportFullGraph(db);
    db.close();

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.relationships).toHaveLength(1);
    expect(snapshot.nodes.find((node) => node.id === "page1")?.title).toBe("Scene A");
    expect(snapshot.relationships[0]).toMatchObject({
      source: "page1",
      target: "page2",
      label: "FEATURES",
    });
  });

  test("exportFullGraph excludes Marloth/Archive pages and their links", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "archive.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertNode("active", {
      title: "Active scene",
      inferred_notion_path: "Marloth/Scenes/active",
    });
    db.upsertNode("archived", {
      title: "Old foil",
      inferred_notion_path: "Marloth/Archive/Foils/old",
    });
    db.upsertNode("archive-root", {
      title: "Archive",
      inferred_notion_path: "Marloth/Archive",
    });
    db.upsertRelationship("active", "archived", "INSPIRATIONS");
    db.upsertRelationship("archived", "archive-root", "PART");

    const snapshot = exportFullGraph(db);
    db.close();

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.id).toBe("active");
    expect(snapshot.relationships).toHaveLength(0);
  });

  test("isArchivedNotionPath matches archive root and nested pages", () => {
    expect(isArchivedNotionPath("Marloth/Archive")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Archive/Foils/old")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Scenes/active")).toBe(false);
    expect(isArchivedNotionPath(null)).toBe(false);
  });

  test("exportExplorerLodGraph builds heuristic layers", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "lod.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertNode("page1", { title: "Scene 1" });
    db.upsertNode("page2", { title: "Scene 2" });
    db.upsertNode("page3", { title: "Feature 1" });
    db.upsertRelationship("page1", "page2", "BLOCKS");
    db.upsertRelationship("page2", "page3", "FEATURES");

    const lod = exportExplorerLodGraph(db);
    db.close();

    expect(lod.layerCount).toBe(DEFAULT_EXPLORER_LOD_LAYER_COUNT);
    expect(lod.levels).toHaveLength(DEFAULT_EXPLORER_LOD_LAYER_COUNT);
    expect(lod.levels[0]!.nodes.length).toBeLessThanOrEqual(lod.levels[1]!.nodes.length);
    expect(lod.levels[lod.levels.length - 1]!.nodes.some((node) => node.id === "page1")).toBe(true);
  });

  test("exportExplorerLodGraph filters to anchor connected component", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "anchor.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertNode("anchor", { title: "Anchor" });
    db.upsertNode("near", { title: "Near" });
    db.upsertNode("far", { title: "Far" });
    db.upsertRelationship("anchor", "near", "RELATES");

    const lod = exportExplorerLodGraph(db, { anchorId: "anchor" });
    db.close();

    const finest = lod.levels[lod.levels.length - 1]!;
    expect(finest.nodes.some((node) => node.id === "anchor")).toBe(true);
    expect(finest.nodes.some((node) => node.id === "near")).toBe(true);
    expect(finest.nodes.some((node) => node.id === "far")).toBe(false);
  });
});
