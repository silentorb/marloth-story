import { expandMarkdownBodyLinks } from "marloth-db/markdown-links";
import type { EditorHost } from "../shared/types";
import { nodeUri } from "../shared/types";

/** Standalone markdown href for in-editor links (relative to current page URL). */
export function standaloneEditorNodeHref(nodeId: string): string {
  return `?node=${nodeId.toLowerCase()}`;
}

function editorHrefForHost(nodeId: string, host: EditorHost): string {
  if (host === "standalone") return standaloneEditorNodeHref(nodeId);
  return nodeUri(nodeId);
}

/** Prepare markdown loaded into Milkdown: expand node links to host navigable hrefs. */
export function prepareEditorMarkdown(body: string, host: EditorHost): string {
  return expandMarkdownBodyLinks(body, (id) => editorHrefForHost(id, host));
}

/** Markdown link inserted into the live editor (display href, not storage shape). */
export function formatEditorNodeMarkdownLink(
  title: string,
  nodeId: string,
  host: EditorHost,
): string {
  return `[${title}](${editorHrefForHost(nodeId, host)})`;
}

/** @deprecated Use prepareEditorMarkdown */
export const preprocessStandaloneMarkdown = prepareEditorMarkdown;
