import {
  DEFAULT_HOME_RECORD_ID,
  exportFullGraph,
  exportOverviewGraph,
  getDatabaseViewDetail,
  getRecordPageDetail,
  GraphDatabase,
  searchRecords,
  updateRecordBody,
  applyOrderedAssociationMove,
  type GraphSnapshot,
  type OrderedAssociationMoveParams,
  type OrderedAssociationViewDetail,
  type RecordPageDetail,
  type DatabaseViewDetail,
} from "marloth-db";
import { statSync } from "node:fs";
import type { RecordSummary } from "../shared/types";

export interface EditorDatabase {
  getHomeId(): string;
  getRecord(id: string, options?: { databaseView?: string; scopeId?: string }): RecordPageDetail | null;
  getDatabaseView(id: string, view?: string): DatabaseViewDetail | null;
  moveOrderedAssociation(
    configId: string,
    params: OrderedAssociationMoveParams,
  ): OrderedAssociationViewDetail | null;
  search(query: string, limit?: number): RecordSummary[];
  saveBody(id: string, body: string): boolean;
  getGraphOverview(): GraphSnapshot;
  getGraphFull(): GraphSnapshot;
  close(): void;
}

function fileIdentity(path: string): string | null {
  try {
    const stat = statSync(path);
    return `${stat.dev}:${stat.ino}`;
  } catch {
    return null;
  }
}

export function openEditorDatabase(dbPath: string): EditorDatabase {
  let db = new GraphDatabase(dbPath);
  let identity = fileIdentity(dbPath);

  const currentDb = (): GraphDatabase => {
    const nextIdentity = fileIdentity(dbPath);
    if (nextIdentity !== identity) {
      db.close();
      db = new GraphDatabase(dbPath);
      identity = nextIdentity;
    }
    return db;
  };

  return {
    getHomeId(): string {
      const active = currentDb();
      const home = getRecordPageDetail(active, DEFAULT_HOME_RECORD_ID);
      if (home) return DEFAULT_HOME_RECORD_ID;
      const recent = searchRecords(active, "", 1);
      return recent[0]?.id ?? DEFAULT_HOME_RECORD_ID;
    },
    getRecord(id: string, options?: { databaseView?: string; scopeId?: string }): RecordPageDetail | null {
      return getRecordPageDetail(currentDb(), id, options);
    },
    getDatabaseView(id: string, view?: string) {
      return getDatabaseViewDetail(currentDb(), id, view);
    },
    moveOrderedAssociation(
      configId: string,
      params: OrderedAssociationMoveParams,
    ): OrderedAssociationViewDetail | null {
      return applyOrderedAssociationMove(currentDb(), configId, params);
    },
    search(query: string, limit?: number): RecordSummary[] {
      return searchRecords(currentDb(), query, limit);
    },
    saveBody(id: string, body: string): boolean {
      return updateRecordBody(currentDb(), id, body);
    },
    getGraphOverview(): GraphSnapshot {
      return exportOverviewGraph(currentDb());
    },
    getGraphFull(): GraphSnapshot {
      return exportFullGraph(currentDb());
    },
    close(): void {
      db.close();
    },
  };
}
