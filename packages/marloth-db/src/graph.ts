import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DDL, SCHEMA_VERSION } from "./schema";

export type PropertyValue = string | number | boolean | null | PropertyValue[] | { [key: string]: PropertyValue };
export type Properties = Record<string, PropertyValue>;

export interface VertexRecord {
  id: string;
  labels: string[];
  properties: Properties;
}

export interface EdgeRecord {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  properties: Properties;
}

export interface GraphCounts {
  vertices: number;
  edges: number;
}

function parseJsonObject(raw: string): Properties {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Properties;
  } catch {
    /* fall through */
  }
  return {};
}

function mergeProperties(base: Properties, patch: Properties): Properties {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function edgeId(sourceId: string, label: string, targetId: string): string {
  return `${sourceId}:${label}:${targetId}`;
}

export class GraphDatabase {
  readonly path: string;
  private db: Database;

  private insertVertex!: ReturnType<Database["prepare"]>;
  private updateVertexProps!: ReturnType<Database["prepare"]>;
  private insertLabel!: ReturnType<Database["prepare"]>;
  private insertEdge!: ReturnType<Database["prepare"]>;
  private updateEdgeProps!: ReturnType<Database["prepare"]>;

  constructor(path: string, options?: { clean?: boolean }) {
    this.path = path;
    if (options?.clean) {
      try {
        rmSync(path, { force: true });
      } catch {
        /* missing file */
      }
    }
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = DELETE");
    this.db.exec(DDL);
    this.prepareStatements();
    this.setMeta("schema_version", String(SCHEMA_VERSION));
  }

  private prepareStatements(): void {
    this.insertVertex = this.db.prepare(
      "INSERT INTO vertices (id, properties) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
    );
    this.updateVertexProps = this.db.prepare(
      "UPDATE vertices SET properties = ? WHERE id = ?",
    );
    this.insertLabel = this.db.prepare(
      "INSERT OR IGNORE INTO vertex_labels (vertex_id, label) VALUES (?, ?)",
    );
    this.insertEdge = this.db.prepare(
      "INSERT INTO edges (id, source_id, target_id, label, properties) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
    );
    this.updateEdgeProps = this.db.prepare(
      "UPDATE edges SET properties = ? WHERE id = ?",
    );
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  upsertVertex(id: string, labels: string[], properties: Properties = {}): void {
    this.insertVertex.run(id, JSON.stringify(properties));
    for (const label of labels) {
      this.insertLabel.run(id, label);
    }
    const existing = this.getVertex(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateVertexProps.run(JSON.stringify(merged), id);
    }
  }

  mergeVertexProperties(id: string, properties: Properties): void {
    const existing = this.getVertex(id);
    if (!existing) {
      this.upsertVertex(id, [], properties);
      return;
    }
    const merged = mergeProperties(existing.properties, properties);
    this.updateVertexProps.run(JSON.stringify(merged), id);
  }

  addVertexLabel(id: string, label: string): void {
    this.insertLabel.run(id, label);
  }

  upsertEdge(
    sourceId: string,
    targetId: string,
    label: string,
    properties: Properties = {},
  ): void {
    const id = edgeId(sourceId, label, targetId);
    this.insertEdge.run(id, sourceId, targetId, label, JSON.stringify(properties));
    const existing = this.getEdge(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateEdgeProps.run(JSON.stringify(merged), id);
    }
  }

  getVertex(id: string): VertexRecord | null {
    const row = this.db.prepare("SELECT id, properties FROM vertices WHERE id = ?").get(id) as
      | { id: string; properties: string }
      | undefined;
    if (!row) return null;
    const labels = this.db
      .prepare("SELECT label FROM vertex_labels WHERE vertex_id = ? ORDER BY label")
      .all(id) as { label: string }[];
    return {
      id: row.id,
      labels: labels.map((l) => l.label),
      properties: parseJsonObject(row.properties),
    };
  }

  getEdge(id: string): EdgeRecord | null {
    const row = this.db
      .prepare("SELECT id, source_id, target_id, label, properties FROM edges WHERE id = ?")
      .get(id) as
      | { id: string; source_id: string; target_id: string; label: string; properties: string }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      label: row.label,
      properties: parseJsonObject(row.properties),
    };
  }

  counts(): GraphCounts {
    const v = this.db.prepare("SELECT COUNT(*) AS c FROM vertices").get() as { c: number };
    const e = this.db.prepare("SELECT COUNT(*) AS c FROM edges").get() as { c: number };
    return { vertices: v.c, edges: e.c };
  }

  searchVerticesByTitle(
    pattern: string,
    limit: number,
  ): { id: string; title: string; path: string | null }[] {
    return this.db
      .prepare(
        `SELECT id,
                COALESCE(
                  NULLIF(json_extract(properties, '$.title'), ''),
                  NULLIF(json_extract(properties, '$.alias'), ''),
                  'Untitled'
                ) AS title,
                json_extract(properties, '$.inferred_notion_path') AS path
         FROM vertices
         WHERE COALESCE(json_extract(properties, '$.title'), json_extract(properties, '$.alias'), '') LIKE ? ESCAPE '\\'
         ORDER BY title COLLATE NOCASE
         LIMIT ?`,
      )
      .all(pattern, limit) as { id: string; title: string; path: string | null }[];
  }

  listVerticesByTitle(limit: number): { id: string; title: string; path: string | null }[] {
    return this.db
      .prepare(
        `SELECT id,
                COALESCE(
                  NULLIF(json_extract(properties, '$.title'), ''),
                  NULLIF(json_extract(properties, '$.alias'), ''),
                  'Untitled'
                ) AS title,
                json_extract(properties, '$.inferred_notion_path') AS path
         FROM vertices
         WHERE json_extract(properties, '$.title') IS NOT NULL
            OR json_extract(properties, '$.alias') IS NOT NULL
         ORDER BY title COLLATE NOCASE
         LIMIT ?`,
      )
      .all(limit) as { id: string; title: string; path: string | null }[];
  }

  listVerticesWithBodyLike(pattern: string): { id: string; body: string }[] {
    return this.db
      .prepare(
        `SELECT id, json_extract(properties, '$.body') AS body
         FROM vertices
         WHERE json_extract(properties, '$.body') LIKE ?`,
      )
      .all(pattern) as { id: string; body: string }[];
  }

  listVerticesForGraphExport(): {
    id: string;
    title: string;
    path: string | null;
    labels: string[];
  }[] {
    const rows = this.db
      .prepare(
        `SELECT id,
                COALESCE(
                  NULLIF(json_extract(properties, '$.title'), ''),
                  NULLIF(json_extract(properties, '$.alias'), ''),
                  'Untitled'
                ) AS title,
                json_extract(properties, '$.inferred_notion_path') AS path
         FROM vertices`,
      )
      .all() as { id: string; title: string; path: string | null }[];

    const labelRows = this.db
      .prepare("SELECT vertex_id, label FROM vertex_labels ORDER BY vertex_id, label")
      .all() as { vertex_id: string; label: string }[];

    const labelsByVertex = new Map<string, string[]>();
    for (const row of labelRows) {
      const labels = labelsByVertex.get(row.vertex_id) ?? [];
      labels.push(row.label);
      labelsByVertex.set(row.vertex_id, labels);
    }

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      path: row.path,
      labels: labelsByVertex.get(row.id) ?? [],
    }));
  }

  listEdgesForGraphExport(): {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
  }[] {
    return this.db
      .prepare("SELECT id, source_id, target_id, label FROM edges")
      .all()
      .map((row) => {
        const r = row as {
          id: string;
          source_id: string;
          target_id: string;
          label: string;
        };
        return {
          id: r.id,
          sourceId: r.source_id,
          targetId: r.target_id,
          label: r.label,
        };
      });
  }

  /** Compact and optimize for deterministic, git-friendly storage. */
  finalize(): void {
    this.db.exec("PRAGMA optimize");
    this.db.exec("VACUUM");
  }

  close(): void {
    this.db.close();
  }
}
