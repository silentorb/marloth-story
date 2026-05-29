import {
  DEFAULT_HOME_NODE_ID,
  exportExplorerLodGraph,
  exportFullGraph,
  getDatabaseViewDetail,
  getNodePageDetail,
  GraphDatabase,
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
} from "marloth-db";
import { statSync } from "node:fs";
import type { NodeSummary } from "../shared/types";

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

function fileIdentity(path: string): string | null {
  try {
    const stat = statSync(path);
    return `${stat.dev}:${stat.ino}`;
  } catch {
    return null;
  }
}

export function openEditorDatabase(dbPath: string): EditorDatabase {
  let db = new GraphDatabase(dbPath);
  let identity = fileIdentity(dbPath);

  const currentDb = (): GraphDatabase => {
    const nextIdentity = fileIdentity(dbPath);
    if (nextIdentity !== identity) {
      db.close();
      db = new GraphDatabase(dbPath);
      identity = nextIdentity;
    }
    return db;
  };

  return {
    getHomeId(): string {
      const active = currentDb();
      const home = getNodePageDetail(active, DEFAULT_HOME_NODE_ID);
      if (home) return DEFAULT_HOME_NODE_ID;
      const recent = searchNodes(active, "", 1);
      return recent[0]?.id ?? DEFAULT_HOME_NODE_ID;
    },
    getNode(id: string, options?: { databaseView?: string; scopeId?: string }): NodePageDetail | null {
      return getNodePageDetail(currentDb(), id, options);
    },
    getDatabaseView(id: string, view?: string) {
      return getDatabaseViewDetail(currentDb(), id, view);
    },
    moveOrderedAssociation(
      configId: string,
      params: OrderedAssociationMoveParams,
    ): OrderedAssociationViewDetail | null {
      return applyOrderedAssociationMove(currentDb(), configId, params);
    },
    search(query: string, limit?: number): NodeSummary[] {
      return searchNodes(currentDb(), query, limit);
    },
    saveBody(id: string, body: string): boolean {
      return updateNodeBody(currentDb(), id, body);
    },
    saveTitle(id: string, title: string): boolean {
      return updateNodeTitle(currentDb(), id, title);
    },
    updateDatabaseRowProperty(
      databaseId: string,
      nodeId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateDatabaseRowProperty(currentDb(), databaseId, nodeId, propertyKey, value);
    },
    updateOutgoingConnectionProperty(
      nodeId: string,
      label: string,
      targetId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateOutgoingConnectionProperty(currentDb(), nodeId, targetId, label, propertyKey, value);
    },
    deleteNode(id: string): NodeLifecycleError | null {
      return deleteNodeInDb(currentDb(), id);
    },
    archiveNode(id: string): NodeLifecycleError | null {
      return archiveNodeInDb(currentDb(), id);
    },
    getGraphFull(): GraphSnapshot {
      return exportFullGraph(currentDb());
    },
    getGraphExplorerLod(options?: { anchorId?: string; layerCount?: number }): GraphLodSnapshot {
      return exportExplorerLodGraph(currentDb(), options);
    },
    close(): void {
      db.close();
    },
  };
}
