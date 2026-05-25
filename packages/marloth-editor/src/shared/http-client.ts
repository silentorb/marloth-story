import type {
  GraphSnapshot,
  RecordPageDetail,
  RecordSummary,
  DatabaseViewDetail,
  OrderedAssociationViewDetail,
} from "./types";
import type { UserSettings, UserSettingsPatch } from "./user-settings";
import type { OrderedAssociationMoveParams } from "marloth-db";

export type { GraphLink, GraphNode, GraphSnapshot, DatabaseViewDetail } from "marloth-db";
export type { OrderedAssociationViewDetail } from "marloth-db";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3847";

export interface GetRecordOptions {
  view?: string;
  scope?: string;
}

export interface EditorApiClient {
  getHomeId(): Promise<string>;
  getRecord(id: string, options?: GetRecordOptions | string): Promise<RecordPageDetail>;
  getDatabaseView(id: string, view?: string): Promise<DatabaseViewDetail>;
  moveOrderedAssociation(
    configId: string,
    params: OrderedAssociationMoveParams,
  ): Promise<OrderedAssociationViewDetail>;
  search(query: string, limit?: number): Promise<RecordSummary[]>;
  saveBody(id: string, body: string): Promise<void>;
  getGraphOverview(): Promise<GraphSnapshot>;
  getGraphFull(): Promise<GraphSnapshot>;
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
    async getRecord(id: string, options?: GetRecordOptions | string): Promise<RecordPageDetail> {
      const normalized =
        typeof options === "string" ? { view: options } : (options ?? {});
      const params = new URLSearchParams();
      if (normalized.view) params.set("view", normalized.view);
      if (normalized.scope) params.set("scope", normalized.scope);
      const query = params.toString();
      const data = await fetchJson<{ record: RecordPageDetail }>(
        `/api/records/${id}${query ? `?${query}` : ""}`,
      );
      return data.record;
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
    async search(query: string, limit = 20): Promise<RecordSummary[]> {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      const data = await fetchJson<{ results: RecordSummary[] }>(
        `/api/records/search?${params}`,
      );
      return data.results;
    },
    async saveBody(id: string, body: string): Promise<void> {
      await fetchJson(`/api/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
    },
    async getGraphOverview(): Promise<GraphSnapshot> {
      const data = await fetchJson<{ graph: GraphSnapshot }>("/api/graph/overview");
      return data.graph;
    },
    async getGraphFull(): Promise<GraphSnapshot> {
      const data = await fetchJson<{ graph: GraphSnapshot }>("/api/graph/full");
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
