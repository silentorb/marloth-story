import {
  createHttpEditorClient,
  DEFAULT_API_BASE_URL,
  type EditorApiClient,
} from "../../shared/http-client";
import type { EditorHost } from "../../shared/types";
import {
  navigateStandaloneNode,
  openStandaloneNodeInNewTab,
} from "../node-links";

export interface EditorApi extends EditorApiClient {
  host: EditorHost;
  navigate(nodeId: string, openInNewTab?: boolean): void;
}

function resolveWebviewApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_MARLOTH_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  // Standalone browser: use the Vite origin so /api is proxied to the editor API (port 3847).
  if (typeof window !== "undefined") return window.location.origin;
  return DEFAULT_API_BASE_URL;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage(message: unknown): void;
      getState(): unknown;
      setState(state: unknown): void;
    };
  }
}

export function createEditorApi(): EditorApi {
  const rest = createHttpEditorClient(resolveWebviewApiBaseUrl());

  if (typeof window !== "undefined" && window.acquireVsCodeApi) {
    const vscode = window.acquireVsCodeApi();
    return {
      host: "vscode",
      getHomeId: rest.getHomeId.bind(rest),
      createNode: rest.createNode.bind(rest),
      createRelationRow: rest.createRelationRow.bind(rest),
      createDatabaseRow: rest.createDatabaseRow.bind(rest),
      getNode: rest.getNode.bind(rest),
      getDatabaseView: rest.getDatabaseView.bind(rest),
      createSectionTab: rest.createSectionTab.bind(rest),
      updateSectionTab: rest.updateSectionTab.bind(rest),
      deleteSectionTab: rest.deleteSectionTab.bind(rest),
      updateSectionColumnOrder: rest.updateSectionColumnOrder.bind(rest),
      updateSectionTabOrder: rest.updateSectionTabOrder.bind(rest),
      deleteDatabaseColumn: rest.deleteDatabaseColumn.bind(rest),
      search: rest.search.bind(rest),
      saveBody: rest.saveBody.bind(rest),
      saveTitle: rest.saveTitle.bind(rest),
      updateDatabaseRowProperty: rest.updateDatabaseRowProperty.bind(rest),
      updateOutgoingRelationshipProperty: rest.updateOutgoingRelationshipProperty.bind(rest),
      linkOutgoingRelationship: rest.linkOutgoingRelationship.bind(rest),
      unlinkOutgoingRelationship: rest.unlinkOutgoingRelationship.bind(rest),
      deleteNode: rest.deleteNode.bind(rest),
      archiveNode: rest.archiveNode.bind(rest),
      getGraphFull: rest.getGraphFull.bind(rest),
      getGraphExplorerLod: rest.getGraphExplorerLod.bind(rest),
      getSchema: rest.getSchema.bind(rest),
      getUserSettings: rest.getUserSettings.bind(rest),
      patchUserSettings: rest.patchUserSettings.bind(rest),
      moveOrderedAssociation: rest.moveOrderedAssociation.bind(rest),
      navigate(nodeId: string, openInNewTab = false): void {
        vscode.postMessage({ type: "navigate", nodeId, openInNewTab });
      },
    };
  }

  return {
    host: "standalone",
    getHomeId: rest.getHomeId.bind(rest),
    createNode: rest.createNode.bind(rest),
    createRelationRow: rest.createRelationRow.bind(rest),
    createDatabaseRow: rest.createDatabaseRow.bind(rest),
    getNode: rest.getNode.bind(rest),
    getDatabaseView: rest.getDatabaseView.bind(rest),
    createSectionTab: rest.createSectionTab.bind(rest),
    updateSectionTab: rest.updateSectionTab.bind(rest),
    deleteSectionTab: rest.deleteSectionTab.bind(rest),
    updateSectionColumnOrder: rest.updateSectionColumnOrder.bind(rest),
    updateSectionTabOrder: rest.updateSectionTabOrder.bind(rest),
    deleteDatabaseColumn: rest.deleteDatabaseColumn.bind(rest),
    search: rest.search.bind(rest),
    saveBody: rest.saveBody.bind(rest),
    saveTitle: rest.saveTitle.bind(rest),
    updateDatabaseRowProperty: rest.updateDatabaseRowProperty.bind(rest),
    updateOutgoingRelationshipProperty: rest.updateOutgoingRelationshipProperty.bind(rest),
    linkOutgoingRelationship: rest.linkOutgoingRelationship.bind(rest),
    unlinkOutgoingRelationship: rest.unlinkOutgoingRelationship.bind(rest),
    deleteNode: rest.deleteNode.bind(rest),
    archiveNode: rest.archiveNode.bind(rest),
    getGraphFull: rest.getGraphFull.bind(rest),
    getGraphExplorerLod: rest.getGraphExplorerLod.bind(rest),
    getSchema: rest.getSchema.bind(rest),
    getUserSettings: rest.getUserSettings.bind(rest),
    patchUserSettings: rest.patchUserSettings.bind(rest),
    moveOrderedAssociation: rest.moveOrderedAssociation.bind(rest),
    navigate(nodeId: string, openInNewTab = false): void {
      if (openInNewTab) {
        openStandaloneNodeInNewTab(nodeId);
        return;
      }
      navigateStandaloneNode(nodeId);
    },
  };
}
