import {
  isMarlothHref,
  recordIdFromHref,
  resolveLinkTarget,
  standaloneRecordUrl,
  type AppView,
} from "../shared/types";
import { DEFAULT_GRAPH_EXPLORER_ANCHOR_ID } from "../shared/graph-explorer";

const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/i;

export function isRecordId(value: string): boolean {
  return RECORD_ID_PATTERN.test(value);
}

export function resolveGraphExplorerAnchor(anchorId?: string | null): string {
  if (anchorId && isRecordId(anchorId)) return anchorId.toLowerCase();
  return DEFAULT_GRAPH_EXPLORER_ANCHOR_ID;
}

export function anchorFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const anchor = new URLSearchParams(window.location.search).get("anchor");
  return anchor && isRecordId(anchor) ? anchor.toLowerCase() : undefined;
}

export function resolveRecordLinkTarget(href: string): string | null {
  if (isMarlothHref(href)) return recordIdFromHref(href);
  return resolveLinkTarget(href);
}

/** True when href already targets a standalone record URL. */
export function isStandaloneRecordHref(href: string, base?: string | URL): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, base ?? window.location.href);
    const recordParam = url.searchParams.get("record");
    return recordParam !== null && /^[a-f0-9]{32}$/i.test(recordParam);
  } catch {
    return false;
  }
}

/** Rewrite in-editor anchors to real browser URLs in standalone mode. */
export function rewriteStandaloneRecordLinks(root: ParentNode, base?: string | URL): void {
  if (typeof window === "undefined") return;
  const baseUrl = base ?? window.location.href;
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    if (isStandaloneRecordHref(href, baseUrl)) continue;
    const recordId = resolveRecordLinkTarget(href);
    if (!recordId) continue;
    anchor.setAttribute("href", standaloneRecordUrl(recordId, baseUrl));
    anchor.removeAttribute("target");
  }
}

export function standaloneViewUrl(
  view: AppView,
  recordId?: string | null,
  base?: string | URL,
  anchorId?: string | null,
): string {
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? window.location.href);
  if (view === "graph-explorer") {
    url.searchParams.set("view", "explorer");
    url.searchParams.set("anchor", resolveGraphExplorerAnchor(anchorId));
  } else url.searchParams.delete("view");
  if (recordId) url.searchParams.set("record", recordId);
  else url.searchParams.delete("record");
  if (view !== "graph-explorer") url.searchParams.delete("anchor");
  return url.toString();
}

export function navigateStandaloneRecord(recordId: string, base?: string | URL): void {
  window.location.assign(standaloneRecordUrl(recordId, base));
}

export function openStandaloneRecordInNewTab(recordId: string, base?: string | URL): void {
  const anchor = document.createElement("a");
  anchor.href = standaloneRecordUrl(recordId, base);
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
}
