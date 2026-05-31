import siteData from "../generated/site-data.json";
import type { SiteNode } from "../generate-data";

export function loadAllNodes(): SiteNode[] {
  return siteData.nodes;
}

export function loadNodeSummaries(): Pick<SiteNode, "id" | "title" | "path">[] {
  return siteData.nodes.map(({ id, title, path }) => ({ id, title, path }));
}

export function getSiteBase(): string {
  return siteData.base;
}

export function getHomeNodeId(): string {
  return siteData.homeNodeId;
}
