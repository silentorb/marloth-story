import { describe, expect, test, afterAll } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  seedTestNode,
  seedTestRelationships,
} from "marloth-db/content/test-helpers";
import { createTestApiFromContent } from "./test-api-setup";

describe("relationship types API", () => {
  const sourceId = "a3333333333333333333333333333333";
  const targetId = "b3333333333333333333333333333333";
  const sceneTypeId = "204dba198db74611b0b49a98dd53e8f5";
  const featureTypeId = "dd0de9867cc345b898929306bdf9fc83";

  const fixture = createTestContentFixture("marloth-rel-types-api-");
  seedTestNode(fixture, { id: sourceId, properties: { title: "Scene page" } });
  seedTestNode(fixture, { id: targetId, properties: { title: "Feature page" } });
  seedTestRelationships(fixture, [
    { source: sourceId, target: sceneTypeId, type: "is_a" },
    { source: targetId, target: featureTypeId, type: "is_a" },
    { source: sourceId, target: targetId, type: "features" },
  ]);

  writeFileSync(
    join(fixture.ctx.store.contentDir, "schema.json"),
    JSON.stringify({
      version: 1,
      relationshipRules: [
        {
          id: "scene-features",
          sourceTypeId: sceneTypeId,
          type: "features",
          allowedTargetTypeIds: [featureTypeId],
        },
      ],
    }),
    "utf-8",
  );

  const api = createTestApiFromContent(fixture);

  test("GET /api/relationship-types lists distinct types in data", async () => {
    const res = await api.handler(new Request("http://127.0.0.1/api/relationship-types"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { types: string[] };
    expect(payload.types).toContain("features");
    expect(payload.types).toContain("is_a");
  });

  test("GET relationship-link-options returns schema allowed targets", async () => {
    const res = await api.handler(
      new Request(
        `http://127.0.0.1/api/nodes/${sourceId}/relationship-link-options?type=features`,
      ),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { allowedTargetTypeIds: string[] | null };
    expect(payload.allowedTargetTypeIds).toEqual([featureTypeId]);
  });

  test("GET relationship-link-options returns null when no rule matches", async () => {
    const res = await api.handler(
      new Request(
        `http://127.0.0.1/api/nodes/${sourceId}/relationship-link-options?type=inspirations`,
      ),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { allowedTargetTypeIds: string[] | null };
    expect(payload.allowedTargetTypeIds).toBeNull();
  });

  afterAll(() => {
    api.handler.close();
    destroyTestContentFixture(fixture);
  });
});
