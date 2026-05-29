import { describe, expect, test, afterAll } from "bun:test";
import {
  archivePathForNode,
  archiveNode,
  DEFAULT_ARCHIVE_NODE_ID,
  deleteNode,
} from "./node-lifecycle";
import { DEFAULT_HOME_NODE_ID, getNodeDetail, searchNodes } from "./queries";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "./content/test-helpers";

const PAGE_ACTIVE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PAGE_ARCHIVED = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const PAGE_DELETE = "cccccccccccccccccccccccccccccccc";

describe("record lifecycle", () => {
  const fixture = createTestContentFixture("marloth-db-lifecycle-");

  seedTestNode(fixture, {
    id: DEFAULT_HOME_NODE_ID,
    labels: ["NotionPage"],
    properties: { title: "Marloth", inferred_notion_path: "Marloth" },
  });
  seedTestNode(fixture, {
    id: DEFAULT_ARCHIVE_NODE_ID,
    labels: ["NotionPage"],
    properties: { title: "Archive", inferred_notion_path: "Marloth" },
  });
  seedTestNode(fixture, {
    id: PAGE_ACTIVE,
    labels: ["NotionPage"],
    properties: {
      title: "Active Scene",
      inferred_notion_path: "Marloth/Scenes/Active Scene",
    },
  });
  seedTestNode(fixture, {
    id: PAGE_ARCHIVED,
    labels: ["NotionPage"],
    properties: {
      title: "Old Scene",
      inferred_notion_path: "Marloth/Archive/Old Scene",
    },
  });

  test("archivePathForNode preserves leaf segment under Archive", () => {
    expect(archivePathForNode("Marloth/Features/Idea", "Idea")).toBe("Marloth/Archive/Idea");
    expect(archivePathForNode(null, "Untitled note")).toBe("Marloth/Archive/Untitled note");
  });

  test("archiveNode moves page under Archive and links to Archive node", () => {
    expect(archiveNode(fixture.ctx, PAGE_ACTIVE)).toBeNull();
    const detail = getNodeDetail(fixture.ctx.db, PAGE_ACTIVE);
    expect(detail?.path).toBe("Marloth/Archive/Active Scene");
    expect(
      fixture.ctx.db.listConnectionsFromSource(PAGE_ACTIVE, "PART")[0]?.targetNodeId,
    ).toBe(DEFAULT_ARCHIVE_NODE_ID);
  });

  test("archiveNode rejects protected and already archived pages", () => {
    expect(archiveNode(fixture.ctx, DEFAULT_HOME_NODE_ID)).toBe("protected");
    expect(archiveNode(fixture.ctx, PAGE_ARCHIVED)).toBe("already_archived");
  });

  test("deleteNode removes vertex and rejects protected pages", () => {
    seedTestNode(fixture, {
      id: PAGE_DELETE,
      labels: ["NotionPage"],
      properties: { title: "Disposable" },
    });
    expect(deleteNode(fixture.ctx, PAGE_DELETE)).toBeNull();
    expect(getNodeDetail(fixture.ctx.db, PAGE_DELETE)).toBeNull();
    expect(deleteNode(fixture.ctx, DEFAULT_HOME_NODE_ID)).toBe("protected");
  });

  test("searchNodes excludes archived pages", () => {
    const hits = searchNodes(fixture.ctx.db, "Scene", 20);
    expect(hits.some((hit) => hit.id === PAGE_ACTIVE)).toBe(false);
    expect(hits.some((hit) => hit.id === PAGE_ARCHIVED)).toBe(false);
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});
