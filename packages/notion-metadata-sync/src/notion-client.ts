import { notionIdToUuid } from "./notion-ids";

export interface NotionPageResponse {
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
}

export interface NotionDatabaseResponse {
  id: string;
  url?: string;
  title?: { plain_text: string }[];
  properties: Record<string, NotionPropertySchemaRaw>;
}

export interface NotionPropertySchemaRaw {
  id: string;
  name?: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionViewListItem {
  id: string;
  name?: string;
  type?: string;
}

export interface NotionViewResponse {
  id: string;
  name?: string;
  type?: string;
  filter?: unknown;
  sorts?: unknown[];
  format?: { table_properties?: { property_id: string; visible?: boolean }[] };
  [key: string]: unknown;
}

export interface NotionQueryResponse {
  results: NotionPageResponse[];
  has_more: boolean;
  next_cursor: string | null;
}

export type FetchFn = typeof fetch;

const NOTION_BASE = "https://api.notion.com/v1";

/** Read-only Notion API client — GET and read POST query only. */
export class NotionReadClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiVersion: string,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  async getPage(pageIdHex: string): Promise<NotionPageResponse> {
    const uuid = notionIdToUuid(pageIdHex);
    return this.getJson<NotionPageResponse>(`${NOTION_BASE}/pages/${uuid}`);
  }

  async getDatabase(databaseIdHex: string): Promise<NotionDatabaseResponse> {
    const uuid = notionIdToUuid(databaseIdHex);
    return this.getJson<NotionDatabaseResponse>(`${NOTION_BASE}/databases/${uuid}`);
  }

  async listViews(databaseIdHex: string): Promise<NotionViewListItem[]> {
    const uuid = notionIdToUuid(databaseIdHex);
    try {
      const data = await this.getJson<{ results?: NotionViewListItem[] }>(
        `${NOTION_BASE}/views?database_id=${uuid}`,
      );
      return data.results ?? [];
    } catch (err) {
      if (isNotFoundOrUnsupported(err)) return [];
      throw err;
    }
  }

  async getView(viewId: string): Promise<NotionViewResponse> {
    const compact = viewId.replace(/-/g, "");
    const pathId = compact.length === 32 ? notionIdToUuid(compact) : viewId;
    return this.getJson<NotionViewResponse>(`${NOTION_BASE}/views/${pathId}`);
  }

  async queryDatabase(
    databaseIdHex: string,
    body: { filter?: unknown; sorts?: unknown[]; page_size?: number; start_cursor?: string },
  ): Promise<NotionQueryResponse> {
    const uuid = notionIdToUuid(databaseIdHex);
    return this.postJson<NotionQueryResponse>(`${NOTION_BASE}/databases/${uuid}/query`, body);
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: this.headers(),
    });
    return parseJsonResponse<T>(res);
  }

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJsonResponse<T>(res);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Notion-Version": this.apiVersion,
    };
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Notion API invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : text.slice(0, 200);
    const err = new Error(`Notion API ${res.status}: ${message}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function isNotFoundOrUnsupported(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  return status === 404 || status === 400;
}

export function pageMetadataPatch(
  page: NotionPageResponse,
  existing: Record<string, unknown>,
  force: boolean,
): Record<string, string | boolean> {
  const patch: Record<string, string | boolean> = {};
  if (page.created_time && (force || !existing.created_at)) {
    patch.created_at = page.created_time;
  }
  if (page.last_edited_time && (force || !existing.modified_at)) {
    patch.modified_at = page.last_edited_time;
  }
  if (page.url && (force || !existing.notion_url)) {
    patch.notion_url = page.url;
  }
  if (page.archived !== undefined && (force || existing.notion_archived === undefined)) {
    patch.notion_archived = page.archived;
  }
  return patch;
}
