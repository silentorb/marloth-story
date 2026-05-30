import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { migrateSchema } from "./schema-migrate";
import { DDL, SCHEMA_VERSION } from "./schema";
import type {
  RelationshipProjectionRow,
  RelationshipRecordRow,
} from "./content/relationship-sync-expand";

export type PropertyValue = string | number | boolean | null | PropertyValue[] | { [key: string]: PropertyValue };
export type Properties = Record<string, PropertyValue>;

export interface Node {
  id: string;
  properties: Properties;
}

export interface Relationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  properties: Properties;
  recordId?: string;
}

export interface GraphCounts {
  nodes: number;
  relationships: number;
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

export function relationshipId(sourceNodeId: string, type: string, targetNodeId: string): string {
  return `${sourceNodeId}:${type}:${targetNodeId}`;
}

function mapProjectionRow(row: {
  id: string;
  record_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  properties: string;
}): Relationship {
  return {
    id: row.id,
    recordId: row.record_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    type: row.type,
    properties: parseJsonObject(row.properties),
  };
}

export class GraphDatabase {
  readonly path: string;
  private db: Database;

  private insertNode!: ReturnType<Database["prepare"]>;
  private updateNodeProps!: ReturnType<Database["prepare"]>;
  private insertRecord!: ReturnType<Database["prepare"]>;
  private updateRecordProps!: ReturnType<Database["prepare"]>;
  private insertProjection!: ReturnType<Database["prepare"]>;
  private updateProjectionProps!: ReturnType<Database["prepare"]>;

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
    migrateSchema(this.db);
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
    this.insertRecord = this.db.prepare(
      `INSERT INTO relationship_records (id, node_a, node_b, composite_type, properties, directed_from)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    );
    this.updateRecordProps = this.db.prepare(
      "UPDATE relationship_records SET properties = ? WHERE id = ?",
    );
    this.insertProjection = this.db.prepare(
      `INSERT INTO relationship_projections (id, record_id, source_node_id, target_node_id, type, properties)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    );
    this.updateProjectionProps = this.db.prepare(
      "UPDATE relationship_projections SET properties = ? WHERE id = ?",
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

  upsertNode(id: string, properties: Properties = {}): void {
    this.insertNode.run(id, JSON.stringify(properties));
    const existing = this.getNode(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateNodeProps.run(JSON.stringify(merged), id);
    }
  }

  mergeNodeProperties(id: string, properties: Properties): void {
    const existing = this.getNode(id);
    if (!existing) {
      this.upsertNode(id, properties);
      return;
    }
    const merged = mergeProperties(existing.properties, properties);
    this.updateNodeProps.run(JSON.stringify(merged), id);
  }

  clearRelationshipCache(): void {
    this.db.exec("DELETE FROM relationship_projections");
    this.db.exec("DELETE FROM relationship_records");
  }

  upsertRelationshipRecord(
    record: RelationshipRecordRow,
    directedFrom?: string | null,
  ): void {
    this.insertRecord.run(
      record.id,
      record.nodeA,
      record.nodeB,
      record.compositeType,
      JSON.stringify(record.properties),
      directedFrom ?? null,
    );
    const existing = this.getRelationshipRecord(record.id);
    if (existing && Object.keys(record.properties).length > 0) {
      const merged = mergeProperties(existing.properties, record.properties);
      this.updateRecordProps.run(JSON.stringify(merged), record.id);
    }
  }

  upsertRelationshipProjection(projection: RelationshipProjectionRow): void {
    this.insertProjection.run(
      projection.id,
      projection.recordId,
      projection.sourceNodeId,
      projection.targetNodeId,
      projection.type,
      JSON.stringify(projection.properties),
    );
    const existing = this.getRelationship(projection.id);
    if (existing && Object.keys(projection.properties).length > 0) {
      const merged = mergeProperties(existing.properties, projection.properties);
      this.updateProjectionProps.run(JSON.stringify(merged), projection.id);
    }
  }

  /** @deprecated Use upsertRelationshipProjection via sync expander. Kept for test helpers. */
  upsertRelationship(
    sourceNodeId: string,
    targetNodeId: string,
    type: string,
    properties: Properties = {},
  ): void {
    const id = relationshipId(sourceNodeId, type, targetNodeId);
    this.insertRecord.run(
      id,
      sourceNodeId < targetNodeId ? sourceNodeId : targetNodeId,
      sourceNodeId < targetNodeId ? targetNodeId : sourceNodeId,
      type,
      JSON.stringify(properties),
      sourceNodeId,
    );
    this.insertProjection.run(
      id,
      id,
      sourceNodeId,
      targetNodeId,
      type,
      JSON.stringify(properties),
    );
    const existing = this.getRelationship(id);
    if (existing && Object.keys(properties).length > 0) {
      const merged = mergeProperties(existing.properties, properties);
      this.updateProjectionProps.run(JSON.stringify(merged), id);
    }
  }

  mergeRelationshipProperties(id: string, properties: Properties): void {
    const existing = this.getRelationship(id);
    if (!existing) return;
    const merged = mergeProperties(existing.properties, properties);
    this.updateProjectionProps.run(JSON.stringify(merged), id);
    if (existing.recordId) {
      this.updateRecordProps.run(JSON.stringify(merged), existing.recordId);
    }
  }

  deleteRelationship(sourceNodeId: string, targetNodeId: string, type: string): boolean {
    const id = relationshipId(sourceNodeId, type, targetNodeId);
    const row = this.getRelationship(id);
    if (!row?.recordId) {
      const result = this.db
        .prepare("DELETE FROM relationship_projections WHERE id = ?")
        .run(id);
      return result.changes > 0;
    }
    const result = this.db
      .prepare("DELETE FROM relationship_records WHERE id = ?")
      .run(row.recordId);
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
    return {
      id: row.id,
      properties: parseJsonObject(row.properties),
    };
  }

  getRelationshipRecord(id: string): RelationshipRecordRow | null {
    const row = this.db
      .prepare(
        "SELECT id, node_a, node_b, composite_type, properties FROM relationship_records WHERE id = ?",
      )
      .get(id) as
      | {
          id: string;
          node_a: string;
          node_b: string;
          composite_type: string;
          properties: string;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      nodeA: row.node_a,
      nodeB: row.node_b,
      compositeType: row.composite_type,
      properties: parseJsonObject(row.properties),
    };
  }

  getRelationship(id: string): Relationship | null {
    const row = this.db
      .prepare(
        `SELECT id, record_id, source_node_id, target_node_id, type, properties
         FROM relationship_projections WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          record_id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
          properties: string;
        }
      | undefined;
    if (!row) return null;
    return mapProjectionRow(row);
  }

  counts(): GraphCounts {
    const n = this.db.prepare("SELECT COUNT(*) AS c FROM nodes").get() as { c: number };
    const r = this.db
      .prepare("SELECT COUNT(*) AS c FROM relationship_projections")
      .get() as { c: number };
    return { nodes: n.c, relationships: r.c };
  }

  searchNodesByTitle(
    pattern: string,
    limit: number,
    allowedTypeIds?: readonly string[],
  ): { id: string; title: string; path: string | null }[] {
    const rows = this.db
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

    if (!allowedTypeIds || allowedTypeIds.length === 0) return rows;

    return rows.filter((row) => this.nodeMatchesAnyAllowedType(row.id, allowedTypeIds));
  }

  listNodesByTitle(
    limit: number,
    allowedTypeIds?: readonly string[],
  ): { id: string; title: string; path: string | null }[] {
    const rows = this.db
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

    if (!allowedTypeIds || allowedTypeIds.length === 0) return rows;

    return rows.filter((row) => this.nodeMatchesAnyAllowedType(row.id, allowedTypeIds));
  }

  private nodeMatchesAnyAllowedType(nodeId: string, allowedTypeIds: readonly string[]): boolean {
    for (const type of ["is_a", "in_database"] as const) {
      for (const connection of this.listRelationshipsFromSource(nodeId, type)) {
        if (allowedTypeIds.includes(connection.targetNodeId)) return true;
      }
    }
    return false;
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
  }[] {
    return this.db
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
  }

  listRelationshipsForGraphExport(): {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    type: string;
  }[] {
    return this.db
      .prepare("SELECT id, source_node_id, target_node_id, type FROM relationship_projections")
      .all()
      .map((row) => {
        const r = row as {
          id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
        };
        return {
          id: r.id,
          sourceNodeId: r.source_node_id,
          targetNodeId: r.target_node_id,
          type: r.type,
        };
      });
  }

  listRelationshipsFromSource(sourceNodeId: string, type?: string): Relationship[] {
    const rows = type
      ? (this.db
          .prepare(
            `SELECT id, record_id, source_node_id, target_node_id, type, properties
             FROM relationship_projections WHERE source_node_id = ? AND type = ? ORDER BY id`,
          )
          .all(sourceNodeId, type) as {
          id: string;
          record_id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
          properties: string;
        }[])
      : (this.db
          .prepare(
            `SELECT id, record_id, source_node_id, target_node_id, type, properties
             FROM relationship_projections WHERE source_node_id = ? ORDER BY type, id`,
          )
          .all(sourceNodeId) as {
          id: string;
          record_id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
          properties: string;
        }[]);

    return rows.map(mapProjectionRow);
  }

  listRelationshipsToTarget(targetNodeId: string, type?: string): Relationship[] {
    const rows = type
      ? (this.db
          .prepare(
            `SELECT id, record_id, source_node_id, target_node_id, type, properties
             FROM relationship_projections WHERE target_node_id = ? AND type = ? ORDER BY id`,
          )
          .all(targetNodeId, type) as {
          id: string;
          record_id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
          properties: string;
        }[])
      : (this.db
          .prepare(
            `SELECT id, record_id, source_node_id, target_node_id, type, properties
             FROM relationship_projections WHERE target_node_id = ? ORDER BY id`,
          )
          .all(targetNodeId) as {
          id: string;
          record_id: string;
          source_node_id: string;
          target_node_id: string;
          type: string;
          properties: string;
        }[]);

    return rows.map(mapProjectionRow);
  }

  countIncidentRelationships(nodeId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM relationship_projections
         WHERE source_node_id = ? OR target_node_id = ?`,
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
