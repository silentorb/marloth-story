import { describe, expect, test, afterAll } from "bun:test";
import { DEFAULT_ARCHIVE_NODE_ID } from "./archive-status";
import {
  filterEntriesForCacheSync,
  isArchiveMembershipEntry,
  listArchiveMemberIds,
  markIncidentRelationshipsArchived,
  unmarkIncidentRelationshipsArchived,
} from "./relationship-archive";
import type { RelationshipEntry } from "./content/relationships-file";
import {
  createTestContentFixture,
  destroyTestContentFixture,
  type TestContentFixture,
} from "./content/test-helpers";

const HUB = DEFAULT_ARCHIVE_NODE_ID;
const NODE_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NODE_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NODE_C = "cccccccccccccccccccccccccccccccc";

function entry(
  a: string,
  b: string,
  type: string,
  extra: Partial<RelationshipEntry> = {},
): RelationshipEntry {
  return { a: a < b ? a : b, b: a < b ? b : a, type, ...extra };
}

describe("relationship-archive helpers", () => {
  test("isArchiveMembershipEntry detects hub includes", () => {
    expect(isArchiveMembershipEntry(entry(HUB, NODE_A, "includes"))).toBe(true);
    expect(isArchiveMembershipEntry(entry(NODE_A, NODE_B, "includes"))).toBe(false);
    expect(isArchiveMembershipEntry(entry(HUB, NODE_A, "is_a", { directedFrom: NODE_A }))).toBe(
      false,
    );
  });

  test("listArchiveMemberIds returns non-hub endpoints", () => {
    const ids = listArchiveMemberIds([
      entry(HUB, NODE_A, "includes"),
      entry(HUB, NODE_B, "includes"),
      entry(NODE_A, NODE_C, "includes"),
    ]);
    expect(ids.sort()).toEqual([NODE_A, NODE_B].sort());
  });

  test("filterEntriesForCacheSync drops archived entries", () => {
    const filtered = filterEntriesForCacheSync([
      entry(NODE_A, NODE_B, "includes"),
      entry(NODE_A, NODE_C, "is_a", { archived: true, directedFrom: NODE_A }),
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.b).toBe(NODE_B);
  });
});

describe("relationship-archive store mutations", () => {
  const fixture: TestContentFixture = createTestContentFixture("marloth-rel-archive-");
  const { store } = fixture.ctx;

  test("markIncidentRelationshipsArchived flags incident edges but not hub includes", () => {
    store.writeRelationshipsFile({
      version: 2,
      relationships: [
        entry(NODE_A, NODE_B, "includes"),
        entry(HUB, NODE_A, "includes"),
        entry(NODE_A, NODE_C, "is_a", { directedFrom: NODE_A }),
      ],
    });

    const changed = markIncidentRelationshipsArchived(store, NODE_A);
    expect(changed).toBe(2);

    const file = store.readRelationshipsFile();
    const byPair = new Map(file.relationships.map((e) => [`${e.a}:${e.b}:${e.type}`, e]));
    expect(byPair.get(`${NODE_A < NODE_B ? NODE_A : NODE_B}:${NODE_A < NODE_B ? NODE_B : NODE_A}:includes`)?.archived).toBe(true);
    expect(byPair.get(`${HUB}:${NODE_A}:includes`)?.archived).toBeUndefined();
    expect(byPair.get(`${NODE_A}:${NODE_C}:is_a`)?.archived).toBe(true);
  });

  test("unmarkIncidentRelationshipsArchived keeps shared edge when other endpoint still archived", () => {
    store.writeRelationshipsFile({
      version: 2,
      relationships: [
        entry(NODE_A, NODE_B, "includes", { archived: true }),
        entry(HUB, NODE_B, "includes"),
      ],
    });

    const stillArchived = new Set([NODE_B]);
    const changed = unmarkIncidentRelationshipsArchived(store, NODE_A, stillArchived);
    expect(changed).toBe(0);
    expect(store.readRelationshipsFile().relationships[0]?.archived).toBe(true);
  });

  test("unmarkIncidentRelationshipsArchived clears flags when other endpoint is active", () => {
    store.writeRelationshipsFile({
      version: 2,
      relationships: [
        entry(NODE_A, NODE_B, "includes", { archived: true }),
        entry(NODE_A, NODE_C, "is_a", { archived: true, directedFrom: NODE_A }),
      ],
    });

    const changed = unmarkIncidentRelationshipsArchived(store, NODE_A, new Set());
    expect(changed).toBe(2);
    for (const rel of store.readRelationshipsFile().relationships) {
      expect(rel.archived).toBeUndefined();
    }
  });

  afterAll(() => {
    destroyTestContentFixture(fixture);
  });
});
