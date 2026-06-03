import { expandMarkdownBodyLinks } from "marloth-db/markdown-links";

/** Markdown href for in-editor links (relative to current page URL). */
export function standaloneEditorNodeHref(nodeId: string): string {
  return `?node=${nodeId.toLowerCase()}`;
}

/** Prepare markdown loaded into Milkdown: expand node links to navigable hrefs. */
export function prepareEditorMarkdown(body: string): string {
  return expandMarkdownBodyLinks(body, (id) => standaloneEditorNodeHref(id));
}

/** Markdown link inserted into the live editor (display href, not storage shape). */
export function formatEditorNodeMarkdownLink(title: string, nodeId: string): string {
  return `[${title}](${standaloneEditorNodeHref(nodeId)})`;
}

/** @deprecated Use prepareEditorMarkdown */
export const preprocessStandaloneMarkdown = prepareEditorMarkdown;
