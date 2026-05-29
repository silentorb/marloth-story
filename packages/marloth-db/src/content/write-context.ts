import type { GraphDatabase } from "../graph";
import { nodeFileName } from "./paths";
import type { CacheSync } from "./sync";
import type { ContentStore } from "./store";
import { openContentGraph } from "./sync";
import type { Properties } from "../graph";

export interface MarlothWriteContext {
  store: ContentStore;
  sync: CacheSync;
  db: GraphDatabase;
}

export function openMarlothWriteContext(
  contentDir: string,
  dbPath: string,
): MarlothWriteContext {
  return openContentGraph(contentDir, dbPath);
}

export function syncAfterNodeWrite(ctx: MarlothWriteContext, id: string): void {
  ctx.sync.syncAfterWrite(nodeFileName(id));
}

export function syncAfterConnectionsWrite(ctx: MarlothWriteContext): void {
  ctx.sync.syncAfterWrite("connections.json");
}

export function mergeNodePropertiesOnContent(
  ctx: MarlothWriteContext,
  id: string,
  patch: Properties,
): boolean {
  const ok = ctx.store.mergeNodeProperties(id, patch);
  if (ok) syncAfterNodeWrite(ctx, id);
  return ok;
}
