import type { GraphSnapshot, RecordDetail, RecordSummary } from "./types";

export type { GraphLink, GraphNode, GraphSnapshot } from "marloth-db";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:3847";

export interface EditorApiClient {
  getHomeId(): Promise<string>;
  getRecord(id: string): Promise<RecordDetail>;
  search(query: string, limit?: number): Promise<RecordSummary[]>;
  saveBody(id: string, body: string): Promise<void>;
  getGraphOverview(): Promise<GraphSnapshot>;
  getGraphFull(): Promise<GraphSnapshot>;
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
    async getRecord(id: string): Promise<RecordDetail> {
      const data = await fetchJson<{ record: RecordDetail }>(`/api/records/${id}`);
      return data.record;
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
