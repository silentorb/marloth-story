import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DDL, DYNAMIC_FIELDS_DDL, SCHEMA_VERSION } from "./schema";

export type PropertyValue = string | number | boolean | null | PropertyValue[] | { [key: string]: PropertyValue };
export type Properties = Record<string, PropertyValue>;

export interface Node {
  id: string;
  labels: string[];
  properties: Properties;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  properties: Properties;
}

export interface GraphCounts {
  nodes: number;
  connections: number;
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

export function connectionId(sourceNodeId: string, label: string, targetNodeId: string): string {
  return `${sourceNodeId}:${label}:${targetNodeId}`;
}

export class GraphDatabase {
  readonly path: string;
  private db: Database;

  private insertNode!: ReturnType<Database["prepare"]>;
  private updateNodeProps!: ReturnType<Database["prepare"]>;
  private insertLabel!: ReturnType<Database["prepare"]>;
  private insertConnection!: ReturnType<Database["prepare"]>;
  private updateConnectionProps!: ReturnType<Database["prepare"]>;

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
    this.db.exec(DYNAMIC_FIELDS_DDL);
    this.prepareStatements();
    this.setMeta("schema_version", String(SCHEMA_VERSION));
  }

  private prepareStatements(): void {
    this.insertNode = this.db.prepare(
      "INSERT INTO nodes (id, properties) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
    );
    this.updateNodeProps = this.db.prepare(
      "UPDATE nodes SET properties = ? WHERE id = ?",
    );
    this.insertLabel = this.db.prepare(
      "INSERT OR IGNORE INTO node_labels (node_id, label) VALUES (?, ?)",
    );
    this.insertConnection = this.db.prepare(
      "INSERT INTO connections (id, source_node_id, target_node_id, label, properties) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
    );
    this.updateConnectionProps = this.db.prepare(
      "UPDATE connections SET properties = ? WHERE id = ?",
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

  upsertNode(id: string, labels: string[], properties: Properties = {}): void {
    this.insertNode.run(id, JSON.stringify(properties));
    for (const label of labels) {
      this.insertLabel.run(id, label);
    }
    const existing = this.getNode(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateNodeProps.run(JSON.stringify(merged), id);
    }
  }

  mergeNodeProperties(id: string, properties: Properties): void {
    const existing = this.getNode(id);
    if (!existing) {
      this.upsertNode(id, [], properties);
      return;
    }
    const merged = mergeProperties(existing.properties, properties);
    this.updateNodeProps.run(JSON.stringify(merged), id);
  }

  mergeConnectionProperties(id: string, properties: Properties): void {
    const existing = this.getConnection(id);
    if (!existing) return;
    const merged = mergeProperties(existing.properties, properties);
    this.updateConnectionProps.run(JSON.stringify(merged), id);
  }

  addNodeLabel(id: string, label: string): void {
    this.insertLabel.run(id, label);
  }

  upsertConnection(
    sourceNodeId: string,
    targetNodeId: string,
    label: string,
    properties: Properties = {},
  ): void {
    const id = connectionId(sourceNodeId, label, targetNodeId);
    this.insertConnection.run(id, sourceNodeId, targetNodeId, label, JSON.stringify(properties));
    const existing = this.getConnection(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateConnectionProps.run(JSON.stringify(merged), id);
    }
  }

  deleteConnection(sourceNodeId: string, targetNodeId: string, label: string): boolean {
    const id = connectionId(sourceNodeId, label, targetNodeId);
    const result = this.db.prepare("DELETE FROM connections WHERE id = ?").run(id);
    return result.changes > 0;
  }

  deleteNode(id: string): boolean {
    const result = this.db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
    return result.changes > 0;
  }

  getNode(id: string): Node | null {
    const row = this.db.prepare("SELECT id, properties FROM nodes WHERE id = ?").get(id) as
      | { id: string; properties: string }
      | undefined;
    if (!row) return null;
    const labels = this.db
      .prepare("SELECT label FROM node_labels WHERE node_id = ? ORDER BY label")
      .all(id) as { label: string }[];
    return {
      id: row.id,
      labels: labels.map((l) => l.label),
      properties: parseJsonObject(row.properties),
    };
  }

  getConnection(id: string): Connection | null {
    const row = this.db
      .prepare(
        "SELECT id, source_node_id, target_node_id, label, properties FROM connections WHERE id = ?",
      )
      .get(id) as
      | {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
          properties: string;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      label: row.label,
      properties: parseJsonObject(row.properties),
    };
  }

  counts(): GraphCounts {
    const n = this.db.prepare("SELECT COUNT(*) AS c FROM nodes").get() as { c: number };
    const c = this.db.prepare("SELECT COUNT(*) AS c FROM connections").get() as { c: number };
    return { nodes: n.c, connections: c.c };
  }

  searchNodesByTitle(
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
         FROM nodes
         WHERE COALESCE(json_extract(properties, '$.title'), json_extract(properties, '$.alias'), '') LIKE ? ESCAPE '\\'
         ORDER BY title COLLATE NOCASE
         LIMIT ?`,
      )
      .all(pattern, limit) as { id: string; title: string; path: string | null }[];
  }

  listNodesByTitle(limit: number): { id: string; title: string; path: string | null }[] {
    return this.db
      .prepare(
        `SELECT id,
                COALESCE(
                  NULLIF(json_extract(properties, '$.title'), ''),
                  NULLIF(json_extract(properties, '$.alias'), ''),
                  'Untitled'
                ) AS title,
                json_extract(properties, '$.inferred_notion_path') AS path
         FROM nodes
         WHERE json_extract(properties, '$.title') IS NOT NULL
            OR json_extract(properties, '$.alias') IS NOT NULL
         ORDER BY title COLLATE NOCASE
         LIMIT ?`,
      )
      .all(limit) as { id: string; title: string; path: string | null }[];
  }

  listNodesWithBodyLike(pattern: string): { id: string; body: string }[] {
    return this.db
      .prepare(
        `SELECT id, json_extract(properties, '$.body') AS body
         FROM nodes
         WHERE json_extract(properties, '$.body') LIKE ?`,
      )
      .all(pattern) as { id: string; body: string }[];
  }

  listNodesForGraphExport(): {
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
         FROM nodes`,
      )
      .all() as { id: string; title: string; path: string | null }[];

    const labelRows = this.db
      .prepare("SELECT node_id, label FROM node_labels ORDER BY node_id, label")
      .all() as { node_id: string; label: string }[];

    const labelsByNode = new Map<string, string[]>();
    for (const row of labelRows) {
      const labels = labelsByNode.get(row.node_id) ?? [];
      labels.push(row.label);
      labelsByNode.set(row.node_id, labels);
    }

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      path: row.path,
      labels: labelsByNode.get(row.id) ?? [],
    }));
  }

  listConnectionsForGraphExport(): {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label: string;
  }[] {
    return this.db
      .prepare("SELECT id, source_node_id, target_node_id, label FROM connections")
      .all()
      .map((row) => {
        const r = row as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
        };
        return {
          id: r.id,
          sourceNodeId: r.source_node_id,
          targetNodeId: r.target_node_id,
          label: r.label,
        };
      });
  }

  listConnectionsFromSource(sourceNodeId: string, label?: string): Connection[] {
    const rows = label
      ? (this.db
          .prepare(
            "SELECT id, source_node_id, target_node_id, label, properties FROM connections WHERE source_node_id = ? AND label = ? ORDER BY id",
          )
          .all(sourceNodeId, label) as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
          properties: string;
        }[])
      : (this.db
          .prepare(
            "SELECT id, source_node_id, target_node_id, label, properties FROM connections WHERE source_node_id = ? ORDER BY label, id",
          )
          .all(sourceNodeId) as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
          properties: string;
        }[]);

    return rows.map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      label: row.label,
      properties: parseJsonObject(row.properties),
    }));
  }

  listConnectionsToTarget(targetNodeId: string, label?: string): Connection[] {
    const rows = label
      ? (this.db
          .prepare(
            "SELECT id, source_node_id, target_node_id, label, properties FROM connections WHERE target_node_id = ? AND label = ? ORDER BY id",
          )
          .all(targetNodeId, label) as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
          properties: string;
        }[])
      : (this.db
          .prepare(
            "SELECT id, source_node_id, target_node_id, label, properties FROM connections WHERE target_node_id = ? ORDER BY id",
          )
          .all(targetNodeId) as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          label: string;
          properties: string;
        }[]);

    return rows.map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      label: row.label,
      properties: parseJsonObject(row.properties),
    }));
  }

  countIncidentConnections(nodeId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS c FROM connections WHERE source_node_id = ? OR target_node_id = ?",
      )
      .get(nodeId, nodeId) as { c: number };
    return row.c;
  }

  /** Run a read query (used by overlay / dynamic-field modules). */
  queryAll<T extends Record<string, unknown>>(sql: string, ...params: SQLQueryBindings[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  /** Run a write statement (used by overlay seed / migration scripts). */
  runExec(sql: string, ...params: SQLQueryBindings[]): void {
    this.db.prepare(sql).run(...params);
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
