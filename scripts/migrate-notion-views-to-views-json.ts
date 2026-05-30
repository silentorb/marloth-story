#!/usr/bin/env bun
/**
 * One-time migration: notion_views tab names/sorts → content/views.json;
 * strip notion_views from node frontmatter.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyViewsFile,
  notionSortToViewSort,
  parseNotionSchema,
  parseNotionViews,
  serializeViewsFile,
  slugifyTabId,
  uniqueTabId,
  type CustomTabDefinition,
  type ViewsFile,
} from "marloth-db";
import { resolveContentPath } from "marloth-db/content";

const SCENES_DB = "204dba198db74611b0b49a98dd53e8f5";

interface RemovedTab {
  nodeId: string;
  title: string;
  tab: string;
}

function parseFrontmatter(raw: string): {
  frontmatter: string;
  body: string;
  properties: Record<string, string>;
} | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1]!;
  const body = match[2] ?? "";
  const properties: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    properties[key] = value;
  }
  return { frontmatter, body, properties };
}

function stripNotionViewsFromFrontmatter(frontmatter: string): string {
  return frontmatter
    .split("\n")
    .filter((line) => !line.startsWith("notion_views:"))
    .join("\n");
}

function serializeMarkdown(properties: Record<string, string>, body: string): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(properties)) {
    if (key === "body") continue;
    const escaped = value.includes(":") || value.includes("'") ? `'${value.replace(/'/g, "''")}'` : value;
    lines.push(`${key}: ${escaped}`);
  }
  lines.push("---");
  if (body.length > 0) lines.push("", body.replace(/^\n/, ""));
  return `${lines.join("\n")}\n`;
}

function hasFilter(filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return false;
  return Object.keys(filter as object).length > 0;
}

function main(): void {
  const contentDir = resolveContentPath();
  const views: ViewsFile = emptyViewsFile();
  const removed: RemovedTab[] = [];
  let migratedTabCount = 0;
  let updatedNodeFiles = 0;

  for (const file of readdirSync(contentDir)) {
    if (!file.endsWith(".md")) continue;
    const nodeId = file.replace(/\.md$/, "");
    const path = join(contentDir, file);
    const raw = readFileSync(path, "utf-8");
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;

    const notionViewsRaw = parsed.properties.notion_views;
    if (!notionViewsRaw) continue;

    let notionViews;
    try {
      notionViews = parseNotionViews(notionViewsRaw);
    } catch {
      console.warn(`Skipping ${file}: invalid notion_views JSON`);
      continue;
    }
    if (!notionViews?.views.length) continue;

    const title = parsed.properties.title ?? nodeId;
    const schema = parseNotionSchema(parsed.properties.notion_schema);

    if (nodeId === SCENES_DB) {
      views.nodes[nodeId] = {
        sections: {
          items: {
            tabs: { kind: "generated", provider: "scenes-by-book" },
          },
        },
      };
    } else {
      const definitions: CustomTabDefinition[] = [];
      const existingIds = new Set<string>();

      for (const view of notionViews.views) {
        if (hasFilter(view.filter)) {
          removed.push({ nodeId, title, tab: view.name });
          continue;
        }
        const id = uniqueTabId(slugifyTabId(view.name), existingIds);
        existingIds.add(id);
        const sorts = (view.sorts ?? [])
          .map((sort) => notionSortToViewSort(sort as { property?: string; direction?: string }, schema))
          .filter((sort): sort is NonNullable<typeof sort> => sort !== null);
        definitions.push({ id, name: view.name, sorts });
        migratedTabCount += 1;
      }

      if (definitions.length === 0) continue;

      views.nodes[nodeId] = {
        sections: {
          items: {
            tabs: { kind: "custom", definitions },
          },
        },
      };
    }

    const nextProperties = { ...parsed.properties };
    delete nextProperties.notion_views;
    const nextFrontmatter = stripNotionViewsFromFrontmatter(parsed.frontmatter);
    const nextPropsFromFm: Record<string, string> = {};
    for (const line of nextFrontmatter.split("\n")) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1).replace(/''/g, "'");
      }
      nextPropsFromFm[key] = value;
    }
    writeFileSync(path, serializeMarkdown(nextPropsFromFm, parsed.body));
    updatedNodeFiles += 1;
  }

  writeFileSync(join(contentDir, "views.json"), serializeViewsFile(views));

  console.log("Migration complete");
  console.log(`  Nodes in views.json: ${Object.keys(views.nodes).length}`);
  console.log(`  Tabs migrated: ${migratedTabCount}`);
  console.log(`  Node files updated (notion_views removed): ${updatedNodeFiles}`);
  console.log(`  Filtered tabs removed: ${removed.length}`);
  for (const entry of removed) {
    console.log(`    - ${entry.title} → ${entry.tab} (${entry.nodeId})`);
  }
}

main();
