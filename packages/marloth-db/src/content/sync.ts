import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DynamicColumnSetRecord, DynamicFieldRecord } from "../dynamic-fields/overlay";
import { GraphDatabase } from "../graph";
import {
  columnSetRecordFromEntry,
  emptyDynamicFieldsFile,
  fieldRecordFromEntry,
  parseDynamicFieldsFile,
} from "./dynamic-fields-file";
import { bodyFromNode } from "./node-file";
import { invalidateSchemaCache } from "../schema-rules/load";
import {
  RELATIONSHIPS_FILENAME,
  DYNAMIC_FIELDS_FILENAME,
  SCHEMA_FILENAME,
  dynamicFieldsFilePath,
  NODE_FILE_PATTERN,
} from "./paths";
import { ContentStore } from "./store";

let cachedDynamicConfig: {
  mtimeMs: number;
  fieldsByDatabase: Map<string, DynamicFieldRecord[]>;
  columnSetsByDatabase: Map<string, DynamicColumnSetRecord[]>;
} | null = null;

export function invalidateDynamicFieldsCache(): void {
  cachedDynamicConfig = null;
}

function loadDynamicConfigFromContent(contentDir: string): {
  fieldsByDatabase: Map<string, DynamicFieldRecord[]>;
  columnSetsByDatabase: Map<string, DynamicColumnSetRecord[]>;
} {
  const path = dynamicFieldsFilePath(contentDir);
  let mtimeMs = 0;
  if (existsSync(path)) {
    mtimeMs = statSync(path).mtimeMs;
  }

  if (cachedDynamicConfig && cachedDynamicConfig.mtimeMs === mtimeMs) {
    return {
      fieldsByDatabase: cachedDynamicConfig.fieldsByDatabase,
      columnSetsByDatabase: cachedDynamicConfig.columnSetsByDatabase,
    };
  }

  let file;
  try {
    file = parseDynamicFieldsFile(readFileSync(path, "utf-8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      file = emptyDynamicFieldsFile();
    } else {
      throw err;
    }
  }

  const fieldsByDatabase = new Map<string, DynamicFieldRecord[]>();
  const columnSetsByDatabase = new Map<string, DynamicColumnSetRecord[]>();

  for (const entry of file.fields) {
    if (!entry.enabled) continue;
    const record = fieldRecordFromEntry(entry);
    const list = fieldsByDatabase.get(record.databaseId) ?? [];
    list.push(record);
    fieldsByDatabase.set(record.databaseId, list);
  }

  for (const entry of file.columnSets) {
    if (!entry.enabled) continue;
    const record = columnSetRecordFromEntry(entry);
    const list = columnSetsByDatabase.get(record.databaseId) ?? [];
    list.push(record);
    columnSetsByDatabase.set(record.databaseId, list);
  }

  cachedDynamicConfig = { mtimeMs, fieldsByDatabase, columnSetsByDatabase };
  return { fieldsByDatabase, columnSetsByDatabase };
}

export function loadDynamicFieldsFromContent(
  contentDir: string,
  databaseId: string,
): DynamicFieldRecord[] {
  return loadDynamicConfigFromContent(contentDir).fieldsByDatabase.get(databaseId) ?? [];
}

export function loadDynamicColumnSetsFromContent(
  contentDir: string,
  databaseId: string,
): DynamicColumnSetRecord[] {
  return loadDynamicConfigFromContent(contentDir).columnSetsByDatabase.get(databaseId) ?? [];
}

export class CacheSync {
  private applying = false;

  constructor(
    readonly store: ContentStore,
    readonly db: GraphDatabase,
  ) {}

  get contentDir(): string {
    return this.store.contentDir;
  }

  isApplying(): boolean {
    return this.applying;
  }

  contentSnapshotMtime(): number {
    let max = 0;
    const scan = (name: string) => {
      const path = join(this.contentDir, name);
      if (!existsSync(path)) return;
      max = Math.max(max, statSync(path).mtimeMs);
    };
    scan(RELATIONSHIPS_FILENAME);
    scan(DYNAMIC_FIELDS_FILENAME);
    scan(SCHEMA_FILENAME);
    try {
      for (const name of readdirSync(this.contentDir)) {
        if (NODE_FILE_PATTERN.test(name)) {
          max = Math.max(max, statSync(join(this.contentDir, name)).mtimeMs);
        }
      }
    } catch {
      /* empty dir */
    }
    return max;
  }

  cacheNeedsRebuild(): boolean {
    const cacheMarker = this.db.getMeta("content_mtime_ms");
    const contentMtime = String(this.contentSnapshotMtime());
    if (!existsSync(this.db.path)) return true;
    return cacheMarker !== contentMtime;
  }

  fullRebuild(): void {
    this.applying = true;
    try {
      this.db.runExec("DELETE FROM relationships");
      this.db.runExec("DELETE FROM nodes");

      for (const id of this.store.listNodeIds()) {
        const node = this.store.readNode(id);
        if (!node) continue;
        const body = bodyFromNode(node);
        const props = { ...node.properties, body };
        this.db.upsertNode(node.id, props);
      }

      for (const connection of this.store.readRelationships()) {
        this.db.upsertRelationship(
          connection.sourceNodeId,
          connection.targetNodeId,
          connection.label,
          connection.properties,
        );
      }

      invalidateDynamicFieldsCache();
      this.db.setMeta("content_mtime_ms", String(this.contentSnapshotMtime()));
    } finally {
      this.applying = false;
    }
  }

  ensureReady(): void {
    if (this.cacheNeedsRebuild()) {
      this.fullRebuild();
    }
  }

  syncNode(id: string): void {
    if (this.applying) return;
    this.applying = true;
    try {
      const node = this.store.readNode(id);
      if (!node) {
        this.db.deleteNode(id);
        return;
      }
      const body = bodyFromNode(node);
      this.db.upsertNode(node.id, { ...node.properties, body });
    } finally {
      this.applying = false;
    }
  }

  syncRelationships(): void {
    if (this.applying) return;
    this.applying = true;
    try {
      this.db.runExec("DELETE FROM relationships");
      for (const connection of this.store.readRelationships()) {
        this.db.upsertRelationship(
          connection.sourceNodeId,
          connection.targetNodeId,
          connection.label,
          connection.properties,
        );
      }
    } finally {
      this.applying = false;
    }
  }

  syncFile(relativeName: string): void {
    if (this.applying) return;

    if (relativeName === RELATIONSHIPS_FILENAME) {
      this.syncRelationships();
      this.db.setMeta("content_mtime_ms", String(this.contentSnapshotMtime()));
      return;
    }

    if (relativeName === DYNAMIC_FIELDS_FILENAME) {
      invalidateDynamicFieldsCache();
      this.db.setMeta("content_mtime_ms", String(this.contentSnapshotMtime()));
      return;
    }

    if (relativeName === SCHEMA_FILENAME) {
      invalidateSchemaCache();
      this.db.setMeta("content_mtime_ms", String(this.contentSnapshotMtime()));
      return;
    }

    const match = NODE_FILE_PATTERN.exec(relativeName);
    if (match) {
      const id = relativeName.slice(0, 32);
      this.syncNode(id);
      this.db.setMeta("content_mtime_ms", String(this.contentSnapshotMtime()));
    }
  }

  syncAfterWrite(relativeName: string): void {
    this.syncFile(relativeName);
  }
}

export function openContentGraph(contentDir: string, dbPath: string): {
  store: ContentStore;
  sync: CacheSync;
  db: GraphDatabase;
} {
  const store = new ContentStore(contentDir);
  const db = new GraphDatabase(dbPath);
  const sync = new CacheSync(store, db);
  sync.ensureReady();
  return { store, sync, db };
}
