import type {
  GraphSnapshot,
  GraphLodSnapshot,
  NodePageDetail,
  NodeSummary,
  DatabaseViewDetail,
  OrderedAssociationViewDetail,
} from "./types";
import type { UserSettings, UserSettingsPatch } from "./user-settings";
import type { OrderedAssociationMoveParams } from "marloth-db";

export type { GraphConnection, GraphNode, GraphSnapshot, GraphLodSnapshot, DatabaseViewDetail } from "marloth-db";
export type { OrderedAssociationViewDetail } from "marloth-db";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3847";

export interface GetNodeOptions {
  view?: string;
  scope?: string;
}

export interface GraphExplorerLodOptions {
  anchorId?: string;
  layerCount?: number;
}

export interface EditorApiClient {
  getHomeId(): Promise<string>;
  getNode(id: string, options?: GetNodeOptions | string): Promise<NodePageDetail>;
  getDatabaseView(id: string, view?: string): Promise<DatabaseViewDetail>;
  moveOrderedAssociation(
    configId: string,
    params: OrderedAssociationMoveParams,
  ): Promise<OrderedAssociationViewDetail>;
  search(query: string, limit?: number): Promise<NodeSummary[]>;
  saveBody(id: string, body: string): Promise<void>;
  saveTitle(id: string, title: string): Promise<void>;
  updateDatabaseRowProperty(
    databaseId: string,
    nodeId: string,
    propertyKey: string,
    value: string | null,
  ): Promise<void>;
  updateOutgoingConnectionProperty(
    nodeId: string,
    label: string,
    targetId: string,
    propertyKey: string,
    value: string | null,
  ): Promise<void>;
  deleteNode(id: string): Promise<void>;
  archiveNode(id: string): Promise<void>;
  getGraphFull(): Promise<GraphSnapshot>;
  getGraphExplorerLod(options?: GraphExplorerLodOptions): Promise<GraphLodSnapshot>;
  getUserSettings(): Promise<UserSettings>;
  patchUserSettings(patch: UserSettingsPatch): Promise<UserSettings>;
}

function parseApiError(text: string, status: number): string {
  try {
    const payload = JSON.parse(text) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    /* not JSON */
  }
  return text.trim() || `Request failed: ${status}`;
}

export function createHttpEditorClient(baseUrl: string): EditorApiClient {
  const normalizedBase = baseUrl.replace(/\/$/, "");

  async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${normalizedBase}${path}`, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(parseApiError(text, res.status));
    }
    return (await res.json()) as T;
  }

  return {
    async getHomeId(): Promise<string> {
      const data = await fetchJson<{ id: string }>("/api/home");
      return data.id;
    },
    async getNode(id: string, options?: GetNodeOptions | string): Promise<NodePageDetail> {
      const normalized =
        typeof options === "string" ? { view: options } : (options ?? {});
      const params = new URLSearchParams();
      if (normalized.view) params.set("view", normalized.view);
      if (normalized.scope) params.set("scope", normalized.scope);
      const query = params.toString();
      const data = await fetchJson<{ node: NodePageDetail }>(
        `/api/nodes/${id}${query ? `?${query}` : ""}`,
      );
      return data.node;
    },
    async getDatabaseView(id: string, view?: string): Promise<DatabaseViewDetail> {
      const params = view ? `?view=${encodeURIComponent(view)}` : "";
      const data = await fetchJson<{ databaseView: DatabaseViewDetail }>(
        `/api/databases/${id}${params}`,
      );
      return data.databaseView;
    },
    async moveOrderedAssociation(
      configId: string,
      params: OrderedAssociationMoveParams,
    ): Promise<OrderedAssociationViewDetail> {
      const data = await fetchJson<{ view: OrderedAssociationViewDetail }>(
        `/api/ordered-associations/${encodeURIComponent(configId)}/move`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        },
      );
      return data.view;
    },
    async search(query: string, limit = 20): Promise<NodeSummary[]> {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      const data = await fetchJson<{ results: NodeSummary[] }>(
        `/api/nodes/search?${params}`,
      );
      return data.results;
    },
    async saveBody(id: string, body: string): Promise<void> {
      await fetchJson(`/api/nodes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
    },
    async saveTitle(id: string, title: string): Promise<void> {
      await fetchJson(`/api/nodes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    },
    async updateDatabaseRowProperty(
      databaseId: string,
      nodeId: string,
      propertyKey: string,
      value: string | null,
    ): Promise<void> {
      await fetchJson(`/api/databases/${databaseId}/rows/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property: propertyKey, value }),
      });
    },
    async updateOutgoingConnectionProperty(
      nodeId: string,
      label: string,
      targetId: string,
      propertyKey: string,
      value: string | null,
    ): Promise<void> {
      await fetchJson(
        `/api/nodes/${nodeId}/connections/${encodeURIComponent(label)}/${targetId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property: propertyKey, value }),
        },
      );
    },
    async deleteNode(id: string): Promise<void> {
      await fetchJson(`/api/nodes/${id}`, { method: "DELETE" });
    },
    async archiveNode(id: string): Promise<void> {
      await fetchJson(`/api/nodes/${id}/archive`, { method: "POST" });
    },
    async getGraphFull(): Promise<GraphSnapshot> {
      const data = await fetchJson<{ graph: GraphSnapshot }>("/api/graph/full");
      return data.graph;
    },
    async getGraphExplorerLod(options?: GraphExplorerLodOptions): Promise<GraphLodSnapshot> {
      const params = new URLSearchParams();
      if (options?.anchorId) params.set("anchor", options.anchorId);
      if (options?.layerCount !== undefined) params.set("layers", String(options.layerCount));
      const query = params.toString();
      const data = await fetchJson<{ graph: GraphLodSnapshot }>(
        `/api/graph/explorer-lod${query ? `?${query}` : ""}`,
      );
      return data.graph;
    },
    async getUserSettings(): Promise<UserSettings> {
      const data = await fetchJson<{ settings: UserSettings }>("/api/user-settings");
      return data.settings;
    },
    async patchUserSettings(patch: UserSettingsPatch): Promise<UserSettings> {
      const data = await fetchJson<{ settings: UserSettings }>("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return data.settings;
    },
  };
}

export async function waitForApi(baseUrl: string, attempts = 40): Promise<boolean> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${normalizedBase}/api/health`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
