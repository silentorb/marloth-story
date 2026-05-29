import type { GraphDatabase, MarlothWriteContext } from "marloth-db";
import { mergeNodePropertiesOnContent } from "marloth-db";
import type { NotionReadClient } from "./notion-client";
import { pageMetadataPatch } from "./notion-client";
import { isNotionHexId } from "./notion-ids";
import type { SyncOptions } from "./config";

export interface PageSyncSummary {
  scanned: number;
  updated: number;
  skipped: number;
  errors: { id: string; message: string }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncPages(
  ctx: MarlothWriteContext,
  client: NotionReadClient,
  rootPageId: string,
  options: SyncOptions,
): Promise<PageSyncSummary> {
  const db = ctx.db;
  const summary: PageSyncSummary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    await client.getPage(rootPageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Preflight failed for Marloth root page (${rootPageId}): ${message}. Ensure the integration is shared with the workspace.`,
    );
  }

  let ids: string[];
  if (options.id) {
    if (!isNotionHexId(options.id)) {
      throw new Error(`--id must be a 32-hex Notion page id, got: ${options.id}`);
    }
    ids = [options.id];
  } else {
    ids = db
      .listNodesForGraphExport()
      .map((v) => v.id)
      .filter((id) => isNotionHexId(id));
    if (options.limit !== undefined && Number.isFinite(options.limit)) {
      ids = ids.slice(0, Math.max(0, options.limit));
    }
  }

  for (const id of ids) {
    summary.scanned += 1;
    const vertex = db.getNode(id);
    if (!vertex) {
      summary.skipped += 1;
      continue;
    }

    try {
      const page = await client.getPage(id);
      const patch = pageMetadataPatch(page, vertex.properties, options.force);
      if (Object.keys(patch).length === 0) {
        summary.skipped += 1;
      } else if (options.dryRun) {
        summary.updated += 1;
        console.log(`[dry-run] would update ${id}: ${Object.keys(patch).join(", ")}`);
      } else {
        mergeNodePropertiesOnContent(ctx, id, patch);
        summary.updated += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ id, message });
      console.error(`Error syncing page ${id}: ${message}`);
    }

    await sleep(350);
  }

  return summary;
}
