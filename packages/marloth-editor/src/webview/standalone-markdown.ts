import { standaloneRecordUrl } from "../shared/types";
import { resolveRecordLinkTarget } from "./record-links";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Rewrite resolvable record links to standalone ?record= URLs before Milkdown parses markdown. */
export function preprocessStandaloneMarkdown(body: string, base?: string | URL): string {
  return body.replace(MARKDOWN_LINK, (full, text, href) => {
    const recordId = resolveRecordLinkTarget(decodeURIComponent(href.trim()));
    if (!recordId) return full;
    return `[${text}](${standaloneRecordUrl(recordId, base)})`;
  });
}
