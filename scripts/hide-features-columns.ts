/**
 * Hide deprecated Features table columns in all synced Notion views.
 *
 * Usage: bun run scripts/hide-features-columns.ts [--dry-run]
 */
import { GraphDatabase } from "../packages/marloth-db/src/graph";
import {
  visiblePropertyIdsForView,
  type NotionDatabaseViews,
  type NotionViewDefinition,
} from "../packages/marloth-db/src/notion-database-schema";

const FEATURES_DB = "dd0de9867cc345b898929306bdf9fc83";

const HIDDEN_PROPERTY_NAMES = new Set([
  "_Form final scenes",
  "_Form final view",
  "Date",
  "Conflicts",
  "_Form scenes",
  "Custom target scene count",
  "Progress",
  "Missing scene count",
]);

const dryRun = process.argv.includes("--dry-run");
const dbPath = process.env.MARLOTH_DB_PATH ?? "data/marloth.sqlite";
const db = new GraphDatabase(dbPath);

const vertex = db.getVertex(FEATURES_DB);
if (!vertex) throw new Error(`Features database not found: ${FEATURES_DB}`);

const stored = JSON.parse(String(vertex.properties.notion_views)) as NotionDatabaseViews;

for (const view of stored.views) {
  const config = view.configuration as { properties?: { property_id?: string; property_name?: string; visible?: boolean }[] } | null;
  if (!config?.properties) continue;

  for (const prop of config.properties) {
    const name = prop.property_name?.trim();
    if (name && HIDDEN_PROPERTY_NAMES.has(name)) {
      prop.visible = false;
    }
  }

  view.visiblePropertyIds = visiblePropertyIdsForView(view).filter((id) => {
    const match = config.properties!.find((p) => p.property_id === id);
    return match?.visible !== false;
  });
}

if (dryRun) {
  for (const view of stored.views) {
    const visible = visiblePropertyIdsForView(view);
    console.log(`${view.name}: ${visible.length} visible columns`);
  }
  console.log("Dry run — no changes written");
} else {
  db.mergeVertexProperties(FEATURES_DB, {
    notion_views: JSON.stringify(stored),
  });
  db.finalize();
  console.log(`Updated notion_views on Features (${stored.views.length} views)`);
}

db.close();
