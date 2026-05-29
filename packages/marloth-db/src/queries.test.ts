import { describe, expect, test, afterAll } from "bun:test";
import { getNodeDetail, searchNodes, updateNodeBody } from "./queries";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "./content/test-helpers";

describe("queries", () => {
  const fixture = createTestContentFixture("marloth-db-queries-");

  test("getNodeDetail returns title, body, and path", () => {
    seedTestNode(fixture, {
      id: "0123456789abcdef0123456789abcdef",
      properties: {
        title: "Alpha",
        body: "# Hello",
        inferred_notion_path: "Marloth/Features/Alpha.md",
      },
    });
    const detail = getNodeDetail(fixture.ctx.db, "0123456789abcdef0123456789abcdef");
    expect(detail?.id).toBe("0123456789abcdef0123456789abcdef");
    expect(detail?.title).toBe("Alpha");
    expect(detail?.body.trimEnd()).toBe("# Hello");
  });

  test("searchNodes matches title prefix", () => {
    seedTestNode(fixture, {
      id: "123456789abcdef0123456789abcdef0",
      properties: { title: "Beta Record" },
    });
    const hits = searchNodes(fixture.ctx.db, "Beta", 10);
    expect(hits.some((h) => h.id === "123456789abcdef0123456789abcdef0")).toBe(true);
  });

  test("updateNodeBody persists markdown", () => {
    seedTestNode(fixture, {
      id: "23456789abcdef0123456789abcdef01",
      properties: { title: "Gamma", body: "old" },
    });
    expect(updateNodeBody(fixture.ctx, "23456789abcdef0123456789abcdef01", "new body")).toBe(true);
    expect(getNodeDetail(fixture.ctx.db, "23456789abcdef0123456789abcdef01")?.body.trimEnd()).toBe(
      "new body",
    );
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});
