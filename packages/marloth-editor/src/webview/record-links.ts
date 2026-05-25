import {
  isMarlothHref,
  recordIdFromHref,
  resolveLinkTarget,
  standaloneRecordUrl,
  type AppView,
} from "../shared/types";

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

export function standaloneViewUrl(view: AppView, recordId?: string | null, base?: string | URL): string {
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? window.location.href);
  if (view === "graph-overview") url.searchParams.set("view", "overview");
  else if (view === "graph-explorer") url.searchParams.set("view", "explorer");
  else url.searchParams.delete("view");
  if (recordId) url.searchParams.set("record", recordId);
  else url.searchParams.delete("record");
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
