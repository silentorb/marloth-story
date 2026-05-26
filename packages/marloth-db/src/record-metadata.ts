import type { GraphDatabase } from "./graph";
import { getRecordDetail } from "./queries";

export interface RecordBacklink {
  sourceId: string;
  title: string;
  path: string | null;
  label: string;
}

export interface RecordPageMetadata {
  createdAt: string | null;
  modifiedAt: string | null;
  connectionCount: number;
  backlinks: RecordBacklink[];
}

function isoTimestampFromProperties(
  properties: Record<string, unknown>,
  key: string,
): string | null {
  const value = properties[key];
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function getRecordPageMetadata(db: GraphDatabase, id: string): RecordPageMetadata | null {
  const vertex = db.getVertex(id);
  if (!vertex) return null;

  const incoming = db.listEdgesToTarget(id);
  const backlinks: RecordBacklink[] = incoming.map((edge) => {
    const source = getRecordDetail(db, edge.sourceId);
    return {
      sourceId: edge.sourceId,
      title: source?.title ?? "Untitled",
      path: source?.path ?? null,
      label: edge.label,
    };
  });

  backlinks.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.label.localeCompare(b.label);
  });

  return {
    createdAt: isoTimestampFromProperties(vertex.properties, "created_at"),
    modifiedAt: isoTimestampFromProperties(vertex.properties, "modified_at"),
    connectionCount: db.countIncidentEdges(id),
    backlinks,
  };
}
