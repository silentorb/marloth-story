/** Canonical internal link scheme stored in markdown bodies. */
export const MARLOTH_LINK_SCHEME = "marloth:";

export const HOME_RECORD_ID = "13458e628ba28073850dea0edb9acde1";
export const ARCHIVE_RECORD_ID = "0f558a609a56485185beed4d1fd1cd9f";

export function isProtectedEditorRecord(id: string): boolean {
  return id === HOME_RECORD_ID || id === ARCHIVE_RECORD_ID;
}

const NOTION_ID_IN_PATH = /([a-f0-9]{32})(?:\.(?:md|csv))?$/i;

export interface RecordSummary {
  id: string;
  title: string;
  path: string | null;
}

export interface RecordDetail extends RecordSummary {
  body: string;
  labels: string[];
}

export type {
  DatabaseTableSection,
  MarkdownSection,
  OrderedAssociationSection,
  PropertiesSection,
  RecordBacklink,
  RecordPageDetail,
  RecordPageMetadata,
  RecordSection,
  RelationRow,
  RelationTableSection,
} from "marloth-db";

export type {
  OrderedAssociationGroup,
  OrderedAssociationRow,
  OrderedAssociationScope,
  OrderedAssociationViewDetail,
} from "marloth-db";

export type EditorHost = "vscode" | "standalone";

export type AppView = "record" | "graph-explorer";

export function marlothHref(recordId: string): string {
  return `${MARLOTH_LINK_SCHEME}${recordId}`;
}

export function isMarlothHref(href: string): boolean {
  return href.startsWith(MARLOTH_LINK_SCHEME);
}

export function recordIdFromHref(href: string): string | null {
  if (!isMarlothHref(href)) return null;
  const id = href.slice(MARLOTH_LINK_SCHEME.length).trim();
  return id || null;
}

export function resolveLinkTarget(href: string): string | null {
  const marlothId = recordIdFromHref(href);
  if (marlothId) return marlothId;
  const decoded = decodeURIComponent(href.trim());
  const match = NOTION_ID_IN_PATH.exec(decoded);
  return match?.[1]?.toLowerCase() ?? null;
}

export function formatMarlothLink(title: string, recordId: string): string {
  return `[${title}](${marlothHref(recordId)})`;
}

export function recordUri(recordId: string): string {
  return `marloth://record/${recordId}`;
}

export function recordIdFromUri(uri: string): string | null {
  const m = /^marloth:\/\/record\/([a-f0-9]{32})$/i.exec(uri);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Browser URL for standalone dev mode (`?record=` query param). */
export function standaloneRecordUrl(recordId: string, base?: string | URL): string {
  const defaultBase =
    typeof window !== "undefined" ? window.location.href : "http://127.0.0.1:5173/";
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? defaultBase);
  url.searchParams.set("record", recordId);
  url.searchParams.delete("view");
  url.searchParams.delete("meta");
  return url.toString();
}

export type { GraphLink, GraphNode, GraphSnapshot, GraphLodSnapshot, DatabaseColumnDef, DatabaseRow, DatabaseViewDetail } from "marloth-db";
