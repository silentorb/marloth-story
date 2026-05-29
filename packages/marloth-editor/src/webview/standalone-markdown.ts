import { standaloneNodeUrl } from "../shared/types";
import { resolveNodeLinkTarget } from "./node-links";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Rewrite resolvable record links to standalone ?node= URLs before Milkdown parses markdown. */
export function preprocessStandaloneMarkdown(body: string, base?: string | URL): string {
  return body.replace(MARKDOWN_LINK, (full, text, href) => {
    const nodeId = resolveNodeLinkTarget(decodeURIComponent(href.trim()));
    if (!nodeId) return full;
    return `[${text}](${standaloneNodeUrl(nodeId, base)})`;
  });
}
