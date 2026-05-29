import {
  DEFAULT_HOME_NODE_ID,
  exportExplorerLodGraph,
  exportFullGraph,
  getDatabaseViewDetail,
  getNodePageDetail,
  searchNodes,
  updateNodeBody,
  updateNodeTitle,
  updateDatabaseRowProperty,
  updateOutgoingConnectionProperty,
  applyOrderedAssociationMove,
  archiveNode as archiveNodeInDb,
  deleteNode as deleteNodeInDb,
  type GraphLodSnapshot,
  type GraphSnapshot,
  type OrderedAssociationMoveParams,
  type OrderedAssociationViewDetail,
  type NodeLifecycleError,
  type NodePageDetail,
  type DatabaseViewDetail,
  type MarlothWriteContext,
} from "marloth-db";
import {
  ContentWatcher,
  openMarlothWriteContext,
} from "marloth-db/content";
import type { NodeSummary } from "../shared/types";
import { resolveContentPath, resolveDbPath } from "./paths";

export interface EditorDatabase {
  getHomeId(): string;
  getNode(id: string, options?: { databaseView?: string; scopeId?: string }): NodePageDetail | null;
  getDatabaseView(id: string, view?: string): DatabaseViewDetail | null;
  moveOrderedAssociation(
    configId: string,
    params: OrderedAssociationMoveParams,
  ): OrderedAssociationViewDetail | null;
  search(query: string, limit?: number): NodeSummary[];
  saveBody(id: string, body: string): boolean;
  saveTitle(id: string, title: string): boolean;
  updateDatabaseRowProperty(
    databaseId: string,
    nodeId: string,
    propertyKey: string,
    value: string | null,
  ): import("marloth-db").ConnectionPropertyUpdateError | null;
  updateOutgoingConnectionProperty(
    nodeId: string,
    label: string,
    targetId: string,
    propertyKey: string,
    value: string | null,
  ): import("marloth-db").ConnectionPropertyUpdateError | null;
  deleteNode(id: string): NodeLifecycleError | null;
  archiveNode(id: string): NodeLifecycleError | null;
  getGraphFull(): GraphSnapshot;
  getGraphExplorerLod(options?: { anchorId?: string; layerCount?: number }): GraphLodSnapshot;
  close(): void;
}

export function openEditorDatabase(
  dbPath = resolveDbPath(),
  contentPath = resolveContentPath(),
): EditorDatabase {
  const writeCtx: MarlothWriteContext = openMarlothWriteContext(contentPath, dbPath);
  const watcher = new ContentWatcher(writeCtx.sync, (err) => {
    console.error("[marloth-content] sync error:", err.message);
  });
  watcher.start();

  return {
    getHomeId(): string {
      const home = getNodePageDetail(writeCtx.db, DEFAULT_HOME_NODE_ID);
      if (home) return DEFAULT_HOME_NODE_ID;
      const recent = searchNodes(writeCtx.db, "", 1);
      return recent[0]?.id ?? DEFAULT_HOME_NODE_ID;
    },
    getNode(id: string, options?: { databaseView?: string; scopeId?: string }): NodePageDetail | null {
      return getNodePageDetail(writeCtx.db, id, options);
    },
    getDatabaseView(id: string, view?: string) {
      return getDatabaseViewDetail(writeCtx.db, id, view);
    },
    moveOrderedAssociation(
      configId: string,
      params: OrderedAssociationMoveParams,
    ): OrderedAssociationViewDetail | null {
      return applyOrderedAssociationMove(writeCtx, configId, params);
    },
    search(query: string, limit?: number): NodeSummary[] {
      return searchNodes(writeCtx.db, query, limit);
    },
    saveBody(id: string, body: string): boolean {
      return updateNodeBody(writeCtx, id, body);
    },
    saveTitle(id: string, title: string): boolean {
      return updateNodeTitle(writeCtx, id, title);
    },
    updateDatabaseRowProperty(
      databaseId: string,
      nodeId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateDatabaseRowProperty(writeCtx, databaseId, nodeId, propertyKey, value);
    },
    updateOutgoingConnectionProperty(
      nodeId: string,
      label: string,
      targetId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateOutgoingConnectionProperty(
        writeCtx,
        nodeId,
        targetId,
        label,
        propertyKey,
        value,
      );
    },
    deleteNode(id: string): NodeLifecycleError | null {
      return deleteNodeInDb(writeCtx, id);
    },
    archiveNode(id: string): NodeLifecycleError | null {
      return archiveNodeInDb(writeCtx, id);
    },
    getGraphFull(): GraphSnapshot {
      return exportFullGraph(writeCtx.db);
    },
    getGraphExplorerLod(options?: { anchorId?: string; layerCount?: number }): GraphLodSnapshot {
      return exportExplorerLodGraph(writeCtx.db, options);
    },
    close(): void {
      watcher.close();
      writeCtx.db.close();
    },
  };
}
