import { describe, expect, test, afterAll } from "bun:test";
import { resolve } from "node:path";
import { GraphDatabase } from "./graph";
import {
  expectedTypeDatabaseForPage,
  findMissingTypeMembershipConnections,
  findSpuriousTypeMembershipConnections,
  findNodeScalarsOnTypedNodes,
  typeDatabaseTitleFromPath,
} from "./type-membership-audit";

describe("type-membership-audit path matching", () => {
  const db = new GraphDatabase(":memory:");

  test("typeDatabaseTitleFromPath prefers deepest matching database segment", () => {
    db.upsertNode("insp-db", ["NotionDatabase"], { title: "Inspirations" });
    db.upsertNode("tr-db", ["NotionDatabase"], { title: "Traversal reasons" });
    db.upsertNode("feat-db", ["NotionDatabase"], { title: "Features" });

    expect(typeDatabaseTitleFromPath(db, "Marloth/Inspirations")).toBe("Inspirations");
    expect(typeDatabaseTitleFromPath(db, "Marloth/Inspirations/Traversal reasons")).toBe(
      "Traversal reasons",
    );
    expect(typeDatabaseTitleFromPath(db, "Marloth/Features/Community")).toBe("Features");
    expect(typeDatabaseTitleFromPath(db, "Marloth/Archive/Lab")).toBeNull();
  });

  test("expectedTypeDatabaseForPage resolves nested related databases", () => {
    db.upsertNode(
      "missions",
      ["NotionPage"],
      {
        title: "Missions",
        inferred_notion_path: "Marloth/Inspirations/Traversal reasons",
      },
    );

    const expected = expectedTypeDatabaseForPage(db, "missions");
    expect(expected?.databaseId).toBe("tr-db");
    expect(expected?.databaseTitle).toBe("Traversal reasons");
  });
});

describe("type-membership-audit (production graph)", () => {
  const dbPath = resolve(import.meta.dir, "../../../data/marloth.sqlite");
  const db = new GraphDatabase(dbPath);

  test("every typed page has an IS_A edge to its expected database", () => {
    const missing = findMissingTypeMembershipConnections(db);
    expect(missing).toEqual([]);
  });

  test("typed pages do not have spurious IS_A edges to other databases", () => {
    const spurious = findSpuriousTypeMembershipConnections(db);
    expect(spurious).toEqual([]);
  });

  test("typed pages do not store row scalars on the vertex", () => {
    const violations = findNodeScalarsOnTypedNodes(db);
    expect(violations).toEqual([]);
  });

  afterAll(() => {
    db.close();
  });
});
