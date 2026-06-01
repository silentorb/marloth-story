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
  relationshipRuleContextForType,
  searchNodes,
  updateNodeBody,
  updateNodeTitle,
  deleteDatabaseColumn as deleteDatabaseColumnInDb,
  updateDatabaseRowProperty,
  updateOutgoingRelationshipProperty,
  linkOutgoingRelationship,
  unlinkOutgoingRelationship,
  type CreateNodeError,
  type LinkOutgoingRelationshipError,
  type UnlinkOutgoingRelationshipError,
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
  type ViewSortSpec,
  type NodeViewConfig,
} from "marloth-db";
import {
  ContentWatcher,
  openMarlothWriteContext,
} from "marloth-db/content";
import type { NodeSummary } from "../shared/types";
import { resolveContentPath, resolveDbPath } from "./paths";
import {
  createSectionTab,
  deleteSectionTab,
  ITEMS_SECTION_KEY,
  patchSectionColumnOrder,
  patchSectionTabOrder,
  readNodeViews,
  updateSectionTab,
} from "./views";

export interface EditorDatabase {
  getHomeId(): string;
  getNode(id: string, options?: { tabId?: string; databaseView?: string; scopeId?: string }): NodePageDetail | null;
  getDatabaseView(id: string, tabId?: string): DatabaseViewDetail | null;
  getNodeViews(nodeId: string): NodeViewConfig | null;
  createSectionTab(
    nodeId: string,
    sectionKey: string,
    input: { name: string; sorts?: ViewSortSpec[] },
  ): ReturnType<typeof createSectionTab>;
  updateSectionTab(
    nodeId: string,
    sectionKey: string,
    tabId: string,
    input: { name?: string; sorts?: ViewSortSpec[] },
  ): ReturnType<typeof updateSectionTab>;
  deleteSectionTab(nodeId: string, sectionKey: string, tabId: string): void;
  updateSectionColumnOrder(
    nodeId: string,
    sectionKey: string,
    columnOrder: string[],
  ): string[];
  updateSectionTabOrder(
    nodeId: string,
    sectionKey: string,
    tabOrder: string[],
  ): import("marloth-db").CustomTabDefinition[];
  deleteDatabaseColumn(
    databaseId: string,
    columnKey: string,
  ): import("marloth-db").DeleteDatabaseColumnResult | import("marloth-db").DeleteDatabaseColumnError;
  getSchema(): SchemaFile;
  listRelationshipTypes(): string[];
  getRelationshipLinkOptions(
    sourceId: string,
    type: string,
  ): { allowedTargetTypeIds: string[] | null };
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
    type: string,
    targetId: string,
    propertyKey: string,
    value: string | null,
  ): import("marloth-db").RelationshipPropertyUpdateError | null;
  deleteNode(id: string): NodeLifecycleError | null;
  archiveNode(id: string): NodeLifecycleError | null;
  createNode(input: CreateNodeInput): CreateNodeResult | CreateNodeError;
  createRelationRow(
    sourceId: string,
    input: { type: string; title: string; properties?: Record<string, string> },
  ): CreateNodeResult | CreateNodeError;
  linkOutgoingRelationship(
    sourceId: string,
    input: { type: string; targetId: string; viaDatabase?: string },
  ): LinkOutgoingRelationshipError | null;
  unlinkOutgoingRelationship(
    sourceId: string,
    type: string,
    targetId: string,
  ): UnlinkOutgoingRelationshipError | null;
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
    getNode(id: string, options?: { tabId?: string; databaseView?: string; scopeId?: string }): NodePageDetail | null {
      const tabId = options?.tabId ?? options?.scopeId ?? options?.databaseView;
      return getNodePageDetail(writeCtx.db, id, {
        tabId,
        schema: schema(),
        contentDir: contentPath,
      });
    },
    getDatabaseView(id: string, tabId?: string) {
      return getDatabaseViewDetail(writeCtx.db, id, tabId, contentPath);
    },
    getNodeViews(nodeId: string) {
      return readNodeViews(writeCtx, nodeId);
    },
    createSectionTab(nodeId: string, sectionKey: string, input: { name: string; sorts?: ViewSortSpec[] }) {
      return createSectionTab(writeCtx, nodeId, sectionKey, input);
    },
    updateSectionTab(
      nodeId: string,
      sectionKey: string,
      tabId: string,
      input: { name?: string; sorts?: ViewSortSpec[] },
    ) {
      return updateSectionTab(writeCtx, nodeId, sectionKey, tabId, input);
    },
    deleteSectionTab(nodeId: string, sectionKey: string, tabId: string) {
      deleteSectionTab(writeCtx, nodeId, sectionKey, tabId);
    },
    updateSectionColumnOrder(nodeId: string, sectionKey: string, columnOrder: string[]) {
      return patchSectionColumnOrder(writeCtx, nodeId, sectionKey, columnOrder);
    },
    updateSectionTabOrder(nodeId: string, sectionKey: string, tabOrder: string[]) {
      return patchSectionTabOrder(writeCtx, nodeId, sectionKey, tabOrder);
    },
    deleteDatabaseColumn(databaseId: string, columnKey: string) {
      return deleteDatabaseColumnInDb(writeCtx, databaseId, columnKey);
    },
    getSchema(): SchemaFile {
      return schema();
    },
    listRelationshipTypes(): string[] {
      return writeCtx.db.listDistinctRelationshipTypes();
    },
    getRelationshipLinkOptions(sourceId: string, type: string) {
      const rule = relationshipRuleContextForType(schema(), writeCtx.db, sourceId, type);
      return {
        allowedTargetTypeIds: rule ? [...rule.allowedTargetTypeIds] : null,
      };
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
      type: string,
      targetId: string,
      propertyKey: string,
      value: string | null,
    ) {
      return updateOutgoingRelationshipProperty(
        writeCtx,
        nodeId,
        targetId,
        type,
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
      input: { type: string; title: string; properties?: Record<string, string> },
    ): CreateNodeResult | CreateNodeError {
      const rule = relationshipRuleContextForType(schema(), writeCtx.db, sourceId, input.type);
      const membershipTypeId =
        rule && rule.allowedTargetTypeIds.length === 1
          ? rule.allowedTargetTypeIds[0]
          : undefined;
      return createNodeInDb(writeCtx, {
        title: input.title,
        link: {
          kind: "outgoing",
          sourceId,
          type: input.type,
          properties: input.properties,
          membershipTypeId,
        },
      });
    },
    linkOutgoingRelationship(
      sourceId: string,
      input: { type: string; targetId: string; viaDatabase?: string },
    ): LinkOutgoingRelationshipError | null {
      return linkOutgoingRelationship(writeCtx, {
        sourceId,
        targetId: input.targetId,
        type: input.type,
        viaDatabase: input.viaDatabase,
        schema: schema(),
      });
    },
    unlinkOutgoingRelationship(
      sourceId: string,
      type: string,
      targetId: string,
    ): UnlinkOutgoingRelationshipError | null {
      return unlinkOutgoingRelationship(writeCtx, sourceId, targetId, type);
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
