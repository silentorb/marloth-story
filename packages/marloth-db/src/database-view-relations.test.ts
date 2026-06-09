import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GraphDatabase } from "./graph";
import { IS_A_TYPE } from "./labels";
import { typeTableMarkerProperties } from "./node-capabilities";
import { getDatabaseViewDetail } from "./database-view";
import { listRelationConnectionsForRow } from "./database-view-relations";

describe("database-view-relations", () => {
  const dir = mkdtempSync(join(tmpdir(), "marloth-db-view-rel-"));
  const dbPath = join(dir, "test.sqlite");
  const db = new GraphDatabase(dbPath);

  const inspirationsDb = "2eea538996934ce8abafc27132e576c1";
  const inspirationTypesDb = "819dc2fea6cc4cddb5fce9cc4efd0e85";
  const nestedViewDb = "1149175cc56d45e1b9f96a7455144ae4";
  const inspirationId = "6c3ea4b72e4e4e6e8f3474bbab490186";
  const tvSeriesTypeId = "c847c77114e94ca5ba74405c2a088c76";

  test("listRelationConnectionsForRow falls back for prop_type with mismatched via_database", () => {
    db.upsertNode(inspirationsDb, {
      ...typeTableMarkerProperties("Inspirations"),
      notion_schema: JSON.stringify({
        syncedAt: "2024-01-01T00:00:00.000Z",
        properties: {
          Name: { id: "title", name: "Name", type: "title", config: {} },
          Type: {
            id: "fsWJ",
            name: "Type",
            type: "relation",
            config: { database_id: inspirationTypesDb },
          },
        },
      }),
    });
    db.upsertNode(inspirationTypesDb, { ...typeTableMarkerProperties("Inspiration types") });
    db.upsertNode(nestedViewDb, { ...typeTableMarkerProperties("Extended story") });
    db.upsertNode(inspirationId, { title: "Ash vs. the Evil Dead" });
    db.upsertNode(tvSeriesTypeId, { title: "TV series" });
    db.upsertRelationship(inspirationId, inspirationsDb, IS_A_TYPE, { row_index: 0 });
    db.upsertRelationship(tvSeriesTypeId, inspirationTypesDb, IS_A_TYPE, { row_index: 0 });
    db.upsertRelationship(inspirationId, tvSeriesTypeId, "prop_type_inspirations", {
      ordinal: 0,
      via_database: nestedViewDb,
      via_view: "default",
    });

    const connections = listRelationConnectionsForRow(
      db,
      inspirationId,
      "prop_type",
      inspirationsDb,
      inspirationTypesDb,
    );

    expect(connections).toHaveLength(1);
    expect(connections[0]!.targetNodeId === tvSeriesTypeId ||
      connections[0]!.sourceNodeId === tvSeriesTypeId).toBe(true);
  });

  test("hydrates Type column when via_database points at a nested database CSV", () => {
    const detail = getDatabaseViewDetail(db, inspirationsDb);
    const row = detail?.rows.find((r) => r.nodeId === inspirationId);
    expect(row?.cells.type).toBe("TV series");
    expect(row?.relationCells?.type).toEqual([
      { targetId: tvSeriesTypeId, title: "TV series" },
    ]);
  });

  test("hydrates Features column with scoped and unscoped includes edges", () => {
    const featuresDb = "dd0de9867cc345b898929306bdf9fc83";
    const inspirationWithMixedFeatures = "e13fc17c7fa440db84b67399994f1c17";
    const cozyHorrorId = "e5cc80dc61ed4c629951cdf472b20b7a";
    const chaoticWorldId = "15258e628ba2805abd70e0c63f03c571";
    const adventureId = "1d458e628ba28026830dfe3db74cba19";
    const darkForestId = "181a3aae0f4b4056b6c28bb49e27978e";

    db.upsertNode(featuresDb, { ...typeTableMarkerProperties("Features") });
    db.upsertNode(inspirationWithMixedFeatures, { title: "The Evil Within 2" });
    db.upsertNode(cozyHorrorId, { title: "Cozy horror" });
    db.upsertNode(chaoticWorldId, { title: "Chaotic world" });
    db.upsertNode(adventureId, { title: "Adventure" });
    db.upsertNode(darkForestId, { title: "Dark forest" });
    db.upsertRelationship(inspirationWithMixedFeatures, inspirationsDb, IS_A_TYPE, {
      row_index: 0,
    });
    for (const featureId of [cozyHorrorId, chaoticWorldId, adventureId, darkForestId]) {
      db.upsertRelationship(featureId, featuresDb, IS_A_TYPE, { row_index: 0 });
    }
    db.upsertRelationship(inspirationWithMixedFeatures, cozyHorrorId, "includes");
    db.upsertRelationship(chaoticWorldId, inspirationWithMixedFeatures, "includes");
    db.upsertRelationship(adventureId, inspirationWithMixedFeatures, "includes", {
      via_database: inspirationsDb,
    });
    db.upsertRelationship(darkForestId, inspirationWithMixedFeatures, "includes");

    const connections = listRelationConnectionsForRow(
      db,
      inspirationWithMixedFeatures,
      "features",
      inspirationsDb,
      featuresDb,
    );
    expect(connections).toHaveLength(4);
    const linkedTitles = connections
      .map((connection) => {
        const otherId =
          connection.sourceNodeId === inspirationWithMixedFeatures
            ? connection.targetNodeId
            : connection.sourceNodeId;
        return db.getNode(otherId)?.properties.title;
      })
      .sort();
    expect(linkedTitles).toEqual([
      "Adventure",
      "Chaotic world",
      "Cozy horror",
      "Dark forest",
    ]);
  });

  afterAll(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
