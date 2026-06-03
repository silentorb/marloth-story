import { canonicalizeMarkdownBodyLinks } from "marloth-db/markdown-links";

/** Prepare markdown loaded into Milkdown: canonicalize node links to `./{id}.md`. */
export function prepareEditorMarkdown(body: string): string {
  return canonicalizeMarkdownBodyLinks(body);
}

/** @deprecated Use prepareEditorMarkdown */
export const preprocessStandaloneMarkdown = prepareEditorMarkdown;
