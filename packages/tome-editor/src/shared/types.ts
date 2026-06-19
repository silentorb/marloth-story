import {
  canonicalNodeMarkdownHref,
  LEGACY_MARLOTH_LINK_SCHEME,
  resolveMarkdownHrefTarget,
  TOME_LINK_SCHEME,
} from "tome-db/markdown-links";

export { LEGACY_MARLOTH_LINK_SCHEME, TOME_LINK_SCHEME };

/** @deprecated Use {@link TOME_LINK_SCHEME} */
export const MARLOTH_LINK_SCHEME = LEGACY_MARLOTH_LINK_SCHEME;

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
} from "tome-db";

export type {
  OrderedAssociationGroup,
  OrderedAssociationRow,
  OrderedAssociationViewDetail,
  TableTabsDetail,
  ViewSortSpec,
} from "tome-db";

export type AppView = "node-page" | "graph-explorer";

/** Default title for pages created via New page (sidebar / command). */
export const NEW_PAGE_DEFAULT_TITLE = "Untitled";

export function tomeHref(nodeId: string): string {
  return `${TOME_LINK_SCHEME}${nodeId}`;
}

/** @deprecated Use {@link tomeHref} */
export const marlothHref = tomeHref;

export function isTomeHref(href: string): boolean {
  return href.startsWith(TOME_LINK_SCHEME) || href.startsWith(LEGACY_MARLOTH_LINK_SCHEME);
}

/** @deprecated Use {@link isTomeHref} */
export const isMarlothHref = isTomeHref;

export function nodeIdFromHref(href: string): string | null {
  if (!isTomeHref(href)) return null;
  const id = href.startsWith(TOME_LINK_SCHEME)
    ? href.slice(TOME_LINK_SCHEME.length).trim()
    : href.slice(LEGACY_MARLOTH_LINK_SCHEME.length).trim();
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
  return `tome://node/${nodeId}`;
}

export function nodeIdFromUri(uri: string): string | null {
  const m = /^(?:tome|marloth):\/\/node\/([a-f0-9]{32})$/i.exec(uri);
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
} from "tome-db";
