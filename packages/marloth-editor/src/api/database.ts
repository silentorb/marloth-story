import {
  DEFAULT_HOME_NODE_ID,
  applyOrderedAssociationMove,
  archiveNode as archiveNodeInDb,
  createNode as createNodeInDb,
  deleteNode as deleteNodeInDb,
  exportExplorerLodGraph,
  exportFullGraph,
  getDatabaseViewDetail,
  getNodePageDetail,
  loadSchemaFromContent,
  relationshipRuleContextForLabel,
  searchNodes,
  updateNodeBody,
  updateNodeTitle,
  updateDatabaseRowProperty,
  updateOutgoingRelationshipProperty,
  type CreateNodeError,
  type CreateNodeInput,
  type CreateNodeResult,
  type GraphLodSnapshot,
  type GraphSnapshot,
  type OrderedAssociationMoveParams,
  type OrderedAssociationViewDetail,
  type NodeLifecycleError,
  type NodePageDetail,
  type DatabaseViewDetail,
  type MarlothWriteContext,
  type SchemaFile,
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
  getSchema(): SchemaFile;
  moveOrderedAssociation(
    configId: string,
    params: OrderedAssociationMoveParams,
  ): OrderedAssociationViewDetail | null;
  search(query: string, limit?: number, allowedTypeIds?: string[]): NodeSummary[];
  saveBody(id: string, body: string): boolean;
  saveTitle(id: string, title: string): boolean;
  updateDatabaseRowProperty(
    databaseId: string,
    nodeId: string,
    propertyKey: string,
    value: string | null,
  ): import("marloth-db").RelationshipPropertyUpdateError | null;
  updateOutgoingRelationshipProperty(
    nodeId: string,
    label: string,
    targetId: string,
    propertyKey: string,
    value: string | null,
  ): import("marloth-db").RelationshipPropertyUpdateError | null;
  deleteNode(id: string): NodeLifecycleError | null;
  archiveNode(id: string): NodeLifecycleError | null;
  createNode(input: CreateNodeInput): CreateNodeResult | CreateNodeError;
  createRelationRow(
    sourceId: string,
    input: { label: string; title: string; properties?: Record<string, string> },
  ): CreateNodeResult | CreateNodeError;
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

  const schema = () => loadSchemaFromContent(contentPath);

  return {
    getHomeId(): string {
      const home = getNodePageDetail(writeCtx.db, DEFAULT_HOME_NODE_ID, { schema: schema() });
      if (home) return DEFAULT_HOME_NODE_ID;
      const recent = searchNodes(writeCtx.db, "", 1);
      return recent[0]?.id ?? DEFAULT_HOME_NODE_ID;
    },
    getNode(id: string, options?: { databaseView?: string; scopeId?: string }): NodePageDetail | null {
      return getNodePageDetail(writeCtx.db, id, { ...options, schema: schema() });
    },
    getDatabaseView(id: string, view?: string) {
      return getDatabaseViewDetail(writeCtx.db, id, view);
    },
    getSchema(): SchemaFile {
      return schema();
    },
    moveOrderedAssociation(
      configId: string,
      params: OrderedAssociationMoveParams,
    ): OrderedAssociationViewDetail | null {
      return applyOrderedAssociationMove(writeCtx, configId, params);
    },
    search(query: string, limit?: number, allowedTypeIds?: string[]): NodeSummary[] {
      return searchNodes(writeCtx.db, query, limit, allowedTypeIds);
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
    updateOutgoingRelationshipProperty(
      nodeId: string,
      label: string,
      targetId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateOutgoingRelationshipProperty(
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
    createNode(input: CreateNodeInput): CreateNodeResult | CreateNodeError {
      return createNodeInDb(writeCtx, input);
    },
    createRelationRow(
      sourceId: string,
      input: { label: string; title: string; properties?: Record<string, string> },
    ): CreateNodeResult | CreateNodeError {
      const rule = relationshipRuleContextForLabel(schema(), writeCtx.db, sourceId, input.label);
      const membershipTypeId =
        rule && rule.allowedTargetTypeIds.length === 1
          ? rule.allowedTargetTypeIds[0]
          : undefined;
      return createNodeInDb(writeCtx, {
        title: input.title,
        link: {
          kind: "outgoing",
          sourceId,
          label: input.label,
          properties: input.properties,
          membershipTypeId,
        },
      });
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
