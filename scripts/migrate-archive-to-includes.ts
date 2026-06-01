/**
 * One-time migration: archive membership via `includes` to the Archive hub,
 * plus empty Archive hub markdown body.
 *
 * Usage: bun scripts/migrate-archive-to-includes.ts
 */
import { readFileSync } from "node:fs";
import {
  DEFAULT_ARCHIVE_NODE_ID,
  isLegacyArchivedNotionPath,
} from "marloth-db";
import {
  openMarlothWriteContext,
  parseNodeFile,
  resolveContentPath,
  defaultDbPathForContent,
  nodeFilePath,
  sortEndpoints,
} from "marloth-db/content";
const INCLUDES_TYPE = "includes";

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const NOTION_32 = /([a-f0-9]{32})\.(?:md|csv)(?:#.*)?$/i;

function extractNotionIdFromHref(href: string): string | null {
  const decoded = decodeURIComponent(href.trim());
  const match = NOTION_32.exec(decoded);
  return match ? match[1]!.toLowerCase() : null;
}

function linkIdsFromMarkdown(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(LINK_RE)) {
    const href = match[1];
    if (!href) continue;
    const id = extractNotionIdFromHref(href);
    if (id) ids.add(id);
  }
  return [...ids];
}

function pathFromProperties(properties: Record<string, unknown>): string | null {
  const path = properties.inferred_notion_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

function hasIncludesToArchive(
  relationships: { a: string; b: string; type: string }[],
  memberId: string,
): boolean {
  const { a, b } = sortEndpoints(DEFAULT_ARCHIVE_NODE_ID, memberId);
  return relationships.some((entry) => entry.a === a && entry.b === b && entry.type === INCLUDES_TYPE);
}

export function migrateArchiveToIncludes(contentDir: string): {
  hubLinksParsed: number;
  hubRelationshipsAdded: number;
  pathNodesScanned: number;
  pathRelationshipsAdded: number;
  archiveBodyCleared: boolean;
  missingHubLinkIds: string[];
} {
  const ctx = openMarlothWriteContext(contentDir, defaultDbPathForContent(contentDir));
  const { store } = ctx;

  let hubRelationshipsAdded = 0;
  const missingHubLinkIds: string[] = [];

  const archiveRaw = readFileSync(nodeFilePath(contentDir, DEFAULT_ARCHIVE_NODE_ID), "utf-8");
  const archiveParsed = parseNodeFile(DEFAULT_ARCHIVE_NODE_ID, archiveRaw);
  const hubLinkIds = linkIdsFromMarkdown(archiveParsed.body);

  let relationships = store.readRelationshipsFile().relationships;

  for (const targetId of hubLinkIds) {
    if (!store.readNode(targetId)) {
      missingHubLinkIds.push(targetId);
      continue;
    }
    if (targetId === DEFAULT_ARCHIVE_NODE_ID) continue;
    if (hasIncludesToArchive(relationships, targetId)) continue;
    store.upsertRelationship(DEFAULT_ARCHIVE_NODE_ID, targetId, INCLUDES_TYPE);
    relationships = store.readRelationshipsFile().relationships;
    hubRelationshipsAdded++;
  }

  let pathRelationshipsAdded = 0;
  let pathNodesScanned = 0;

  for (const id of store.listNodeIds()) {
    if (id === DEFAULT_ARCHIVE_NODE_ID) continue;
    const node = store.readNode(id);
    if (!node) continue;
    const path = pathFromProperties(node.properties);
    if (!isLegacyArchivedNotionPath(path)) continue;
    pathNodesScanned++;
    if (hasIncludesToArchive(relationships, id)) continue;
    store.upsertRelationship(DEFAULT_ARCHIVE_NODE_ID, id, INCLUDES_TYPE);
    relationships = store.readRelationshipsFile().relationships;
    pathRelationshipsAdded++;
  }

  const { body: _removed, ...props } = archiveParsed.properties;
  store.writeNode({ id: DEFAULT_ARCHIVE_NODE_ID, properties: props }, "");
  ctx.sync.syncNode(DEFAULT_ARCHIVE_NODE_ID);
  ctx.sync.syncRelationships();
  ctx.db.close();

  return {
    hubLinksParsed: hubLinkIds.length,
    hubRelationshipsAdded,
    pathNodesScanned,
    pathRelationshipsAdded,
    archiveBodyCleared: true,
    missingHubLinkIds,
  };
}

if (import.meta.main) {
  const contentDir = resolveContentPath();
  const result = migrateArchiveToIncludes(contentDir);
  console.log(JSON.stringify(result, null, 2));
}
