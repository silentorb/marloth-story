import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  exportExplorerLodGraph,
  exportFullGraph,
  exportOverviewGraph,
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

    db.upsertVertex("page1", ["NotionPage"], {
      title: "Scene A",
      inferred_notion_path: "Marloth/Scenes",
    });
    db.upsertVertex("page2", ["NotionPage"], {
      title: "Feature B",
      inferred_notion_path: "Marloth/Features",
    });
    db.upsertEdge("page1", "page2", "FEATURES");

    const snapshot = exportFullGraph(db);
    db.close();

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.links).toHaveLength(1);
    expect(snapshot.nodes.find((node) => node.id === "page1")?.title).toBe("Scene A");
    expect(snapshot.links[0]).toMatchObject({
      source: "page1",
      target: "page2",
      label: "FEATURES",
    });
  });

  test("exportFullGraph excludes Marloth/Archive pages and their links", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "archive.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertVertex("active", ["NotionPage"], {
      title: "Active scene",
      inferred_notion_path: "Marloth/Scenes/active",
    });
    db.upsertVertex("archived", ["NotionPage"], {
      title: "Old foil",
      inferred_notion_path: "Marloth/Archive/Foils/old",
    });
    db.upsertVertex("archive-root", ["NotionPage"], {
      title: "Archive",
      inferred_notion_path: "Marloth/Archive",
    });
    db.upsertEdge("active", "archived", "INSPIRATIONS");
    db.upsertEdge("archived", "archive-root", "PART");

    const snapshot = exportFullGraph(db);
    db.close();

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.id).toBe("active");
    expect(snapshot.links).toHaveLength(0);
  });

  test("isArchivedNotionPath matches archive root and nested pages", () => {
    expect(isArchivedNotionPath("Marloth/Archive")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Archive/Foils/old")).toBe(true);
    expect(isArchivedNotionPath("Marloth/Scenes/active")).toBe(false);
    expect(isArchivedNotionPath(null)).toBe(false);
  });

  test("exportOverviewGraph aggregates cross-database links", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "overview.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertVertex("db-scenes", ["NotionDatabase"], { title: "Scenes" });
    db.upsertVertex("db-features", ["NotionDatabase"], { title: "Features" });
    db.upsertVertex("db-untitled", ["NotionDatabase"], { title: "Untitled" });

    db.upsertVertex("scene1", ["NotionPage"], {
      title: "Scene 1",
      inferred_notion_path: "Marloth/Scenes/scene1",
    });
    db.upsertVertex("scene2", ["NotionPage"], {
      title: "Scene 2",
      inferred_notion_path: "Marloth/Scenes/scene2",
    });
    db.upsertVertex("feature1", ["NotionPage"], {
      title: "Feature 1",
      inferred_notion_path: "Marloth/Features/feature1",
    });

    db.upsertEdge("scene1", "feature1", "FEATURES");
    db.upsertEdge("scene2", "feature1", "FEATURES");
    db.upsertEdge("scene1", "scene2", "BLOCKS");

    const snapshot = exportOverviewGraph(db);
    db.close();

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.nodes.find((node) => node.id === "db-scenes")?.val).toBe(2);
    expect(snapshot.nodes.find((node) => node.id === "db-features")?.val).toBe(1);

    const crossLink = snapshot.links.find(
      (link) => link.source === "db-scenes" && link.target === "db-features",
    );
    expect(crossLink?.label).toBe("FEATURES");
    expect(crossLink?.weight).toBe(2);
    expect(snapshot.links.some((link) => link.label === "BLOCKS")).toBe(false);
  });

  test("exportExplorerLodGraph builds five heuristic layers", () => {
    tempDir = mkdtempSync(join(tmpdir(), "marloth-graph-export-"));
    dbPath = join(tempDir, "lod.sqlite");
    const db = new GraphDatabase(dbPath);

    db.upsertVertex("page1", ["NotionPage"], { title: "Scene 1" });
    db.upsertVertex("page2", ["NotionPage"], { title: "Scene 2" });
    db.upsertVertex("page3", ["NotionPage"], { title: "Feature 1" });
    db.upsertEdge("page1", "page2", "BLOCKS");
    db.upsertEdge("page2", "page3", "FEATURES");

    const lod = exportExplorerLodGraph(db);
    db.close();

    expect(lod.layerCount).toBe(DEFAULT_EXPLORER_LOD_LAYER_COUNT);
    expect(lod.levels).toHaveLength(DEFAULT_EXPLORER_LOD_LAYER_COUNT);
    expect(lod.levels[0]!.nodes.length).toBeLessThanOrEqual(lod.levels[1]!.nodes.length);
    expect(lod.levels[lod.levels.length - 1]!.nodes.some((node) => node.id === "page1")).toBe(true);
  });
});
