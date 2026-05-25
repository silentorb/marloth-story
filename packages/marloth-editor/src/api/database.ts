import {
  DEFAULT_HOME_RECORD_ID,
  getRecordDetail,
  GraphDatabase,
  searchRecords,
  updateRecordBody,
} from "marloth-db";
import type { RecordDetail, RecordSummary } from "../shared/types";

export interface EditorDatabase {
  getHomeId(): string;
  getRecord(id: string): RecordDetail | null;
  search(query: string, limit?: number): RecordSummary[];
  saveBody(id: string, body: string): boolean;
  close(): void;
}

export function openEditorDatabase(dbPath: string): EditorDatabase {
  const db = new GraphDatabase(dbPath);
  return {
    getHomeId(): string {
      const home = getRecordDetail(db, DEFAULT_HOME_RECORD_ID);
      if (home) return DEFAULT_HOME_RECORD_ID;
      const recent = searchRecords(db, "", 1);
      return recent[0]?.id ?? DEFAULT_HOME_RECORD_ID;
    },
    getRecord(id: string): RecordDetail | null {
      return getRecordDetail(db, id);
    },
    search(query: string, limit?: number): RecordSummary[] {
      return searchRecords(db, query, limit);
    },
    saveBody(id: string, body: string): boolean {
      return updateRecordBody(db, id, body);
    },
    close(): void {
      db.close();
    },
  };
}
