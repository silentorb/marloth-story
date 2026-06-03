import {
  canonicalNodeMarkdownHref,
  resolveMarkdownHrefTarget,
} from "marloth-db/markdown-links";

/** Legacy internal link scheme (resolved at read time; not written to new content). */
export const MARLOTH_LINK_SCHEME = "marloth:";

export const HOME_NODE_ID = "13458e628ba28073850dea0edb9acde1";
export const ARCHIVE_NODE_ID = "0f558a609a56485185beed4d1fd1cd9f";

export function isProtectedEditorNode(id: string): boolean {
  return id === HOME_NODE_ID || id === ARCHIVE_NODE_ID;
}

export type {
  DatabaseTableSection,
  MarkdownSection,
  NodeBacklink,
  NodeDetail,
  NodePageDetail,
  NodePageMetadata,
  NodeSection,
  NodeSummary,
  OrderedAssociationSection,
  PropertiesSection,
  RelationRow,
  RelationTableSection,
} from "marloth-db";

export type {
  OrderedAssociationGroup,
  OrderedAssociationRow,
  OrderedAssociationViewDetail,
  TableTabsDetail,
  ViewSortSpec,
} from "marloth-db";

export type EditorHost = "vscode" | "standalone";

export type AppView = "node-page" | "graph-explorer";

/** Default title for pages created via New page (sidebar / command). */
export const NEW_PAGE_DEFAULT_TITLE = "Untitled";

export function marlothHref(nodeId: string): string {
  return `${MARLOTH_LINK_SCHEME}${nodeId}`;
}

export function isMarlothHref(href: string): boolean {
  return href.startsWith(MARLOTH_LINK_SCHEME);
}

export function nodeIdFromHref(href: string): string | null {
  if (!isMarlothHref(href)) return null;
  const id = href.slice(MARLOTH_LINK_SCHEME.length).trim();
  return id || null;
}

export function resolveLinkTarget(href: string): string | null {
  return resolveMarkdownHrefTarget(href);
}

/** Relative href stored in git-tracked node markdown (`content/data/{id}.md`). */
export function nodeMarkdownHref(nodeId: string): string {
  return canonicalNodeMarkdownHref(nodeId);
}

export function formatNodeMarkdownLink(title: string, nodeId: string): string {
  return `[${title}](${nodeMarkdownHref(nodeId)})`;
}

/** @deprecated Use formatNodeMarkdownLink for stored markdown. */
export function formatMarlothLink(title: string, nodeId: string): string {
  return formatNodeMarkdownLink(title, nodeId);
}

export function nodeUri(nodeId: string): string {
  return `marloth://node/${nodeId}`;
}

export function nodeIdFromUri(uri: string): string | null {
  const m = /^marloth:\/\/node\/([a-f0-9]{32})$/i.exec(uri);
  return m?.[1]?.toLowerCase() ?? null;
}

import { stripTableSearchParams } from "./table-search-url";

/** Browser URL for standalone dev mode (`?node=` query param). */
export function standaloneNodeUrl(nodeId: string, base?: string | URL): string {
  const defaultBase =
    typeof window !== "undefined" ? window.location.href : "http://127.0.0.1:5173/";
  const url = base instanceof URL ? new URL(base.href) : new URL(base ?? defaultBase);
  url.searchParams.set("node", nodeId);
  url.searchParams.delete("view");
  url.searchParams.delete("tab");
  url.searchParams.delete("meta");
  stripTableSearchParams(url);
  return url.toString();
}

export type {
  GraphRelationship,
  GraphNode,
  GraphSnapshot,
  GraphLodSnapshot,
  DatabaseColumnDef,
  DatabaseRow,
  DatabaseViewDetail,
  RelationLink,
} from "marloth-db";
