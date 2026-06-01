import { describe, expect, test, afterAll } from "bun:test";
import { getNodeDetail, searchNodes, updateNodeBody } from "./queries";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
} from "./content/test-helpers";

describe("queries", () => {
  const fixture = createTestContentFixture("marloth-db-queries-");

  test("getNodeDetail returns title and body", () => {
    seedTestNode(fixture, {
      id: "0123456789abcdef0123456789abcdef",
      properties: {
        title: "Alpha",
        body: "# Hello",
      },
    });
    const detail = getNodeDetail(fixture.ctx.db, "0123456789abcdef0123456789abcdef");
    expect(detail?.id).toBe("0123456789abcdef0123456789abcdef");
    expect(detail?.title).toBe("Alpha");
    expect(detail?.body.trimEnd()).toBe("# Hello");
    expect(detail?.primaryTypeTitle).toBeNull();
  });

  test("searchNodes matches title prefix", () => {
    seedTestNode(fixture, {
      id: "123456789abcdef0123456789abcdef0",
      properties: { title: "Beta Record" },
    });
    const hits = searchNodes(fixture.ctx.db, "Beta", 10);
    expect(hits.some((h) => h.id === "123456789abcdef0123456789abcdef0")).toBe(true);
  });

  test("searchNodes matches body when includeBody is enabled", () => {
    const bodyOnlyId = "3456789abcdef0123456789abcdef012";
    seedTestNode(fixture, {
      id: bodyOnlyId,
      properties: {
        title: "Unrelated Title",
        body: "unique-body-marker-xyz",
      },
    });
    const titleOnly = searchNodes(fixture.ctx.db, "unique-body-marker", 10);
    expect(titleOnly.some((h) => h.id === bodyOnlyId)).toBe(false);

    const withBody = searchNodes(fixture.ctx.db, "unique-body-marker", 10, undefined, {
      includeBody: true,
    });
    expect(withBody.some((h) => h.id === bodyOnlyId)).toBe(true);
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
