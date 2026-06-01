import { describe, expect, test, afterAll } from "bun:test";
import { resolve } from "node:path";
import { GraphDatabase } from "./graph";
import { typeTableMarkerProperties } from "./node-capabilities";
import { openMarlothWriteContext } from "./content/write-context";
import {
  expectedTypeDatabaseForPage,
  findMissingTypeMembershipRelationships,
  findSpuriousTypeMembershipRelationships,
  findNodeScalarsOnTypedNodes,
  typeDatabaseTitleFromPath,
} from "./type-membership-audit";

describe("type-membership-audit path matching", () => {
  const db = new GraphDatabase(":memory:");

  test("typeDatabaseTitleFromPath prefers deepest matching database segment", () => {
    db.upsertNode("insp-db", { ...typeTableMarkerProperties("Inspirations") });
    db.upsertNode("tr-db", { ...typeTableMarkerProperties("Traversal reasons") });
    db.upsertNode("feat-db", { ...typeTableMarkerProperties("Features") });

    expect(typeDatabaseTitleFromPath(db, "Marloth/Inspirations")).toBe("Inspirations");
    expect(typeDatabaseTitleFromPath(db, "Marloth/Inspirations/Traversal reasons")).toBe(
      "Traversal reasons",
    );
    expect(typeDatabaseTitleFromPath(db, "Marloth/Features/Community")).toBe("Features");
    expect(typeDatabaseTitleFromPath(db, "Marloth/Archive/Lab")).toBeNull();
  });

  test("expectedTypeDatabaseForPage no longer infers from legacy paths", () => {
    db.upsertNode("missions", { title: "Missions" });
    expect(expectedTypeDatabaseForPage(db, "missions")).toBeNull();
  });
});

const productionContentDir = resolve(import.meta.dir, "../../../content");
const productionDbPath = resolve(import.meta.dir, "../../../data/marloth.sqlite");
/** Run manually: `bun test src/type-membership-audit.test.ts` with production block un-skipped after `bun run content:sync`. */
describe.skip("type-membership-audit (production graph)", () => {
  const ctx = openMarlothWriteContext(productionContentDir, productionDbPath);
  const db = ctx.db;

  test("every typed page has an IS_A edge to its expected database", () => {
    const missing = findMissingTypeMembershipRelationships(db);
    expect(missing).toEqual([]);
  });

  test("typed pages do not have spurious IS_A edges to other databases", () => {
    const spurious = findSpuriousTypeMembershipRelationships(db);
    expect(spurious).toEqual([]);
  });

  test("typed pages do not store row scalars on the vertex", () => {
    const violations = findNodeScalarsOnTypedNodes(db);
    expect(violations).toEqual([]);
  });

  afterAll(() => {
    ctx.db.close();
  });
});
