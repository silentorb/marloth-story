import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase, IS_A_LABEL } from "marloth-db";
import { createApiHandler } from "./server";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";
const PARTS_DB = "5e45eefc69a14f45b988ad1f3c9d1ef5";
const PRODUCTS_DB = "4e973268d3474f71bd7992094fb39663";

describe("ordered-associations API", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-ordered-api-"));
  const dbPath = join(dir, "graph.sqlite");
  const db = new GraphDatabase(dbPath);

  const book = "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const part = "part1111111111111111111111111111";
  const scene1 = "scene111111111111111111111111111";
  const scene2 = "scene222222222222222222222222222";

  db.upsertVertex(PRODUCTS_DB, ["NotionDatabase"], { title: "Products" });
  db.upsertVertex(PARTS_DB, ["NotionDatabase"], { title: "Parts database" });
  db.upsertVertex(SCENES_DB, ["NotionDatabase"], { title: "Scenes", body: "" });
  db.upsertVertex(book, ["NotionPage"], { title: "TWOLD" });
  db.upsertVertex(part, ["NotionPage"], { title: "Part 1" });
  db.upsertVertex(scene1, ["NotionPage"], { title: "Scene One" });
  db.upsertVertex(scene2, ["NotionPage"], { title: "Scene Two" });
  db.upsertEdge(book, PRODUCTS_DB, IS_A_LABEL, { order: "1", row_index: 0 });
  db.upsertEdge(part, PARTS_DB, IS_A_LABEL, { row_index: 0 });
  db.upsertEdge(part, book, "PRODUCTS", { ordinal: 0 });
  db.upsertEdge(scene1, SCENES_DB, IS_A_LABEL, { order: "10" });
  db.upsertEdge(scene2, SCENES_DB, IS_A_LABEL, { order: "20" });
  db.upsertEdge(scene1, book, "PRODUCT", { ordinal: 0 });
  db.upsertEdge(scene2, book, "PRODUCT", { ordinal: 0 });
  db.upsertEdge(scene1, part, "PART", { ordinal: 0 });
  db.upsertEdge(scene2, part, "PART", { ordinal: 1 });
  db.close();

  const handler = createApiHandler(dbPath);

  test("GET record with scope returns ordered-association section", async () => {
    const res = await handler(
      new Request(`http://127.0.0.1/api/records/${SCENES_DB}?scope=${book}`),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      record: { sections: Array<{ type: string; configId?: string }> };
    };
    const section = payload.record.sections.find((entry) => entry.type === "ordered-association");
    expect(section?.configId).toBe("scenes-by-book");
  });

  test("PATCH move reorders scenes", async () => {
    const res = await handler(
      new Request("http://127.0.0.1/api/ordered-associations/scenes-by-book/move", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId: book,
          sceneId: scene2,
          targetGroupId: part,
          targetIndex: 0,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      view: { groups: Array<{ rows: Array<{ sceneId: string }> }> };
    };
    expect(payload.view.groups[0]?.rows[0]?.sceneId).toBe(scene2);
  });

  test("PATCH move rejects invalid payload", async () => {
    const res = await handler(
      new Request("http://127.0.0.1/api/ordered-associations/scenes-by-book/move", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId: book }),
      }),
    );
    expect(res.status).toBe(400);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});
