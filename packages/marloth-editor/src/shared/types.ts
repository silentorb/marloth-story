/** Canonical internal link scheme stored in markdown bodies. */
export const MARLOTH_LINK_SCHEME = "marloth:";

export const HOME_RECORD_ID = "72b6fb455b824b78962b0e509cc091c9";

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

export type EditorHost = "vscode" | "standalone";

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
