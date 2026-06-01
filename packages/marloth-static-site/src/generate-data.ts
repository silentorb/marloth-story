import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ContentStore } from "marloth-db/content";
import type { ResolvedConfig } from "./config";

/** Matches `DEFAULT_HOME_NODE_ID` in marloth-db queries. */
export const DEFAULT_HOME_NODE_ID = "13458e628ba28073850dea0edb9acde1";

export interface SiteNode {
  id: string;
  title: string;
  body: string;
}

export interface SiteData {
  homeNodeId: string;
  base: string;
  nodes: SiteNode[];
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

export function loadNodesFromContent(contentDir: string): SiteNode[] {
  const store = new ContentStore(contentDir);
  return store.listNodeIds().map((id) => {
    const node = store.readNode(id);
    if (!node) throw new Error(`Missing node ${id}`);
    const props = node.properties as Record<string, unknown>;
    const body = typeof props.body === "string" ? props.body : "";
    return {
      id: node.id,
      title: titleFromProperties(props),
      body,
    };
  });
}

export function writeSiteData(config: ResolvedConfig, outFile: string): SiteData {
  const nodes = loadNodesFromContent(config.contentDir);
  const data: SiteData = {
    homeNodeId: DEFAULT_HOME_NODE_ID,
    base: config.base,
    nodes,
  };
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(data), "utf8");
  return data;
}

export function defaultSiteDataPath(packageRoot: string): string {
  return join(packageRoot, "src/generated/site-data.json");
}
