import type { GraphDatabase } from "./graph";
import { findMarkdownLinksToTarget } from "./markdown-links";
import { getRecordDetail } from "./queries";

export interface RecordBacklink {
  sourceId: string;
  title: string;
  path: string | null;
  linkText: string | null;
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

  const backlinks: RecordBacklink[] = [];
  const seenSources = new Set<string>();

  for (const candidate of db.listVerticesWithBodyLike(`%${id}%`)) {
    if (candidate.id === id) continue;
    const matches = findMarkdownLinksToTarget(candidate.body, id);
    if (matches.length === 0 || seenSources.has(candidate.id)) continue;

    seenSources.add(candidate.id);
    const source = getRecordDetail(db, candidate.id);
    const linkText = matches[0]?.linkText.trim() || null;
    backlinks.push({
      sourceId: candidate.id,
      title: source?.title ?? "Untitled",
      path: source?.path ?? null,
      linkText,
    });
  }

  backlinks.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return (a.linkText ?? "").localeCompare(b.linkText ?? "", undefined, { sensitivity: "base" });
  });

  return {
    createdAt: isoTimestampFromProperties(vertex.properties, "created_at"),
    modifiedAt: isoTimestampFromProperties(vertex.properties, "modified_at"),
    connectionCount: db.countIncidentEdges(id),
    backlinks,
  };
}
