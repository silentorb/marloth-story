import type { GraphDatabase, MarlothWriteContext } from "marloth-db";
import { mergeNodePropertiesOnContent, syncAfterConnectionsWrite } from "marloth-db";
import { TYPE_MEMBERSHIP_LABELS, slugifyPropertyKey } from "marloth-db";
import { databaseMetadataPatch, type NotionReadClient } from "./notion-client";
import { isNotionHexId, notionIdToHex } from "./notion-ids";
import {
  extractPagePropertyValue,
  mapDatabaseSchema,
  mapViewDefinition,
  type NotionDatabaseSchema,
} from "./notion-schema";
import type { SyncOptions } from "./config";

export interface DatabaseSyncSummary {
  scanned: number;
  updated: number;
  skipped: number;
  errors: { id: string; message: string }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncDatabases(
  ctx: MarlothWriteContext,
  client: NotionReadClient,
  options: SyncOptions,
): Promise<DatabaseSyncSummary> {
  const db = ctx.db;
  const summary: DatabaseSyncSummary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  let ids: string[];
  if (options.id) {
    if (!isNotionHexId(options.id)) {
      throw new Error(`--id must be a 32-hex Notion database id, got: ${options.id}`);
    }
    ids = [options.id];
  } else {
    ids = db
      .listNodesForGraphExport()
      .filter((v) => v.labels.includes("NotionDatabase"))
      .map((v) => v.id);
    if (options.limit !== undefined && Number.isFinite(options.limit)) {
      ids = ids.slice(0, Math.max(0, options.limit));
    }
  }

  for (const id of ids) {
    summary.scanned += 1;
    const node = db.getNode(id);
    if (!node?.labels.includes("NotionDatabase")) {
      summary.skipped += 1;
      continue;
    }

    try {
      const database = await client.getDatabase(id);
      const schema = mapDatabaseSchema(database);

      const viewItems = await client.listViews(id);
      const views = [];
      for (const item of viewItems) {
        try {
          const full = await client.getView(item.id);
          views.push(mapViewDefinition(full));
          await sleep(200);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`Skipping view ${item.id} on database ${id}: ${message}`);
        }
      }

      const patch: Record<string, string> = {
        ...databaseMetadataPatch(database, node.properties, options.force),
        notion_schema: JSON.stringify(schema),
        notion_views: JSON.stringify({
          syncedAt: new Date().toISOString(),
          views,
        }),
      };

      if (options.dryRun) {
        summary.updated += 1;
        console.log(
          `[dry-run] would update database ${id}: ${views.length} views, ${Object.keys(schema.properties).length} properties`,
        );
      } else {
        mergeNodePropertiesOnContent(ctx, id, patch);
        if (options.enrichRows) {
          await enrichDatabaseRows(ctx, client, id, schema, views[0] ?? null, options.dryRun);
        }
        summary.updated += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ id, message });
      console.error(`Error syncing database ${id}: ${message}`);
    }

    await sleep(350);
  }

  return summary;
}

async function enrichDatabaseRows(
  ctx: MarlothWriteContext,
  client: NotionReadClient,
  databaseId: string,
  schema: NotionDatabaseSchema,
  primaryView: { filter?: unknown | null; sorts?: unknown[] } | null,
  dryRun: boolean,
): Promise<void> {
  const db = ctx.db;
  let cursor: string | undefined;
  do {
    const query = await client.queryDatabase(databaseId, {
      filter: primaryView?.filter ?? undefined,
      sorts: primaryView?.sorts?.length ? primaryView.sorts : undefined,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of query.results) {
      const pageHex = notionIdToHex(page.id);
      const props = page as unknown as { properties?: Record<string, unknown> };
      const cellPatch: Record<string, string> = {};

      for (const [name, def] of Object.entries(schema.properties)) {
        if (def.type === "title") continue;
        const value = extractPagePropertyValue(props.properties, name, def.type);
        if (value !== null) {
          cellPatch[slugifyPropertyKey(name)] = value;
        }
      }

      if (Object.keys(cellPatch).length === 0) continue;

      const connections = TYPE_MEMBERSHIP_LABELS.flatMap((label) =>
        db.listConnectionsFromSource(pageHex, label),
      ).filter((c) => c.targetNodeId === databaseId);

      if (dryRun) continue;

      for (const connection of connections) {
        ctx.store.mergeConnectionProperties(
          connection.sourceNodeId,
          connection.targetNodeId,
          connection.label,
          { ...connection.properties, ...cellPatch },
        );
      }
    }

    cursor = query.has_more && query.next_cursor ? query.next_cursor : undefined;
    await sleep(350);
  } while (cursor);

  if (!dryRun) {
    syncAfterConnectionsWrite(ctx);
  }
}
