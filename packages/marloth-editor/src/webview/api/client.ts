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
  return import.meta.env.VITE_MARLOTH_API_URL ?? DEFAULT_API_BASE_URL;
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
      getNode: rest.getNode.bind(rest),
      getDatabaseView: rest.getDatabaseView.bind(rest),
      search: rest.search.bind(rest),
      saveBody: rest.saveBody.bind(rest),
      saveTitle: rest.saveTitle.bind(rest),
      updateDatabaseRowProperty: rest.updateDatabaseRowProperty.bind(rest),
      updateOutgoingConnectionProperty: rest.updateOutgoingConnectionProperty.bind(rest),
      deleteNode: rest.deleteNode.bind(rest),
      archiveNode: rest.archiveNode.bind(rest),
      getGraphFull: rest.getGraphFull.bind(rest),
      getGraphExplorerLod: rest.getGraphExplorerLod.bind(rest),
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
    getNode: rest.getNode.bind(rest),
    getDatabaseView: rest.getDatabaseView.bind(rest),
    search: rest.search.bind(rest),
    saveBody: rest.saveBody.bind(rest),
    saveTitle: rest.saveTitle.bind(rest),
    updateDatabaseRowProperty: rest.updateDatabaseRowProperty.bind(rest),
    updateOutgoingConnectionProperty: rest.updateOutgoingConnectionProperty.bind(rest),
    deleteNode: rest.deleteNode.bind(rest),
    archiveNode: rest.archiveNode.bind(rest),
    getGraphFull: rest.getGraphFull.bind(rest),
    getGraphExplorerLod: rest.getGraphExplorerLod.bind(rest),
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
