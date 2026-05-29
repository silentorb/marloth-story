import {
  isMarlothHref,
  nodeIdFromHref,
  resolveLinkTarget,
  standaloneNodeUrl,
  type AppView,
} from "../shared/types";
import { DEFAULT_GRAPH_EXPLORER_ANCHOR_ID } from "../shared/graph-explorer";

const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/i;

export function isNodeId(value: string): boolean {
  return RECORD_ID_PATTERN.test(value);
}

export function resolveGraphExplorerAnchor(anchorId?: string | null): string {
  if (anchorId && isNodeId(anchorId)) return anchorId.toLowerCase();
  return DEFAULT_GRAPH_EXPLORER_ANCHOR_ID;
}

export function anchorFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const anchor = new URLSearchParams(window.location.search).get("anchor");
  return anchor && isNodeId(anchor) ? anchor.toLowerCase() : undefined;
}

export function resolveNodeLinkTarget(href: string): string | null {
  if (isMarlothHref(href)) return nodeIdFromHref(href);
  return resolveLinkTarget(href);
}

/** True when href already targets a standalone node URL. */
export function isStandaloneNodeHref(href: string, base?: string | URL): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, base ?? window.location.href);
    const nodeParam = url.searchParams.get("node");
    return nodeParam !== null && /^[a-f0-9]{32}$/i.test(nodeParam);
  } catch {
    return false;
  }
}

/** Rewrite in-editor anchors to real browser URLs in standalone mode. */
export function rewriteStandaloneNodeLinks(root: ParentNode, base?: string | URL): void {
  if (typeof window === "undefined") return;
  const baseUrl = base ?? window.location.href;
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    if (isStandaloneNodeHref(href, baseUrl)) continue;
    const nodeId = resolveNodeLinkTarget(href);
    if (!nodeId) continue;
    anchor.setAttribute("href", standaloneNodeUrl(nodeId, baseUrl));
    anchor.removeAttribute("target");
  }
}

export function metadataExpandedFromLocation(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("meta") === "1";
}

export function syncMetadataExpandedParam(expanded: boolean, base?: string | URL): void {
  if (typeof window === "undefined") return;
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? window.location.href);
  if (expanded) url.searchParams.set("meta", "1");
  else url.searchParams.delete("meta");
  window.history.replaceState({}, "", url.toString());
}

export function stripMetadataParamFromUrl(url: URL): void {
  url.searchParams.delete("meta");
}

export function standaloneViewUrl(
  view: AppView,
  nodeId?: string | null,
  base?: string | URL,
  anchorId?: string | null,
): string {
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? window.location.href);
  if (view === "graph-explorer") {
    url.searchParams.set("view", "explorer");
    url.searchParams.set("anchor", resolveGraphExplorerAnchor(anchorId));
  } else if (view === "create-node") {
    url.searchParams.set("view", "create");
  } else url.searchParams.delete("view");
  if (nodeId) url.searchParams.set("node", nodeId);
  else url.searchParams.delete("node");
  stripMetadataParamFromUrl(url);
  if (view !== "graph-explorer") url.searchParams.delete("anchor");
  return url.toString();
}

export function navigateStandaloneNode(nodeId: string, base?: string | URL): void {
  window.location.assign(standaloneNodeUrl(nodeId, base));
}

export function openStandaloneNodeInNewTab(nodeId: string, base?: string | URL): void {
  const anchor = document.createElement("a");
  anchor.href = standaloneNodeUrl(nodeId, base);
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
}
