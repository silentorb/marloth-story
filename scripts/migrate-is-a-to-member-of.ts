#!/usr/bin/env bun
/**
 * Migrate set membership slug is_a → "member_of", views sections.items → sections.members,
 * and ordered-collections.json membershipEdgeType is_a → "member_of".
 *
 * Usage: bun scripts/migrate-is-a-to-member-of.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_ROOT = join(import.meta.dir, "../content");
const RELATIONSHIPS_PATH = join(CONTENT_ROOT, "data/relationships.json");
const ASSOCIATIONS_PATH = join(CONTENT_ROOT, "model/associations.json");
const VIEWS_PATH = join(CONTENT_ROOT, "model/views.json");
const ORDERED_COLLECTIONS_PATH = join(CONTENT_ROOT, "model/ordered-collections.json");

const dryRun = process.argv.includes("--dry-run");

interface RelationshipEntry {
  a: string;
  b: string;
  type: string;
  directedFrom?: string;
  archived?: boolean;
  properties?: Record<string, unknown>;
}

interface ViewsNodeSection {
  tabs?: unknown;
  columnOrder?: string[];
  [key: string]: unknown;
}

interface OrderedAssociationConfigEntry {
  membershipEdgeType?: string;
  [key: string]: unknown;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function migrateViewsSections(sections: Record<string, ViewsNodeSection>): {
  sections: Record<string, ViewsNodeSection>;
  renamed: number;
} {
  if (!sections.items) {
    return { sections, renamed: 0 };
  }
  const { items, ...rest } = sections;
  return {
    sections: { ...rest, members: items },
    renamed: 1,
  };
}

function main(): void {
  const relFile = loadJson<{ version: number; relationships: RelationshipEntry[] }>(
    RELATIONSHIPS_PATH,
  );

  let typeRenamed = 0;
  for (const entry of relFile.relationships) {
    if (entry.type === "is_a") {
      entry.type = "member_of";
      typeRenamed++;
    }
  }

  const associationsFile = loadJson<{ version: number; associations: Record<string, unknown> }>(
    ASSOCIATIONS_PATH,
  );
  if (associationsFile.associations.is_a) {
    delete associationsFile.associations.is_a;
  }
  associationsFile.associations.member_of = {
    bidirectional: true,
    perspectives: ["member_of", "members"],
  };

  const viewsFile = loadJson<{
    version: number;
    nodes: Record<string, { sections?: Record<string, ViewsNodeSection> }>;
  }>(VIEWS_PATH);

  let viewsSectionsRenamed = 0;
  for (const node of Object.values(viewsFile.nodes)) {
    if (!node.sections) continue;
    const migrated = migrateViewsSections(node.sections);
    if (migrated.renamed > 0) {
      node.sections = migrated.sections;
      viewsSectionsRenamed++;
    }
  }

  const orderedCollectionsFile = loadJson<{
    version: number;
    configs: OrderedAssociationConfigEntry[];
  }>(ORDERED_COLLECTIONS_PATH);

  let orderedAssociationsRenamed = 0;
  for (const config of orderedCollectionsFile.configs) {
    if (config.membershipEdgeType === "is_a") {
      config.membershipEdgeType = "member_of";
      orderedAssociationsRenamed++;
    }
  }

  console.log(`Relationships is_a → member_of: ${typeRenamed}`);
  console.log(`views.json sections.items → members: ${viewsSectionsRenamed} nodes`);
  console.log(`ordered-collections.json membershipEdgeType: ${orderedAssociationsRenamed} configs`);
  console.log(`associations.json: "member_of" registered`);

  if (dryRun) {
    console.log("Dry run — no files written.");
    return;
  }

  writeFileSync(RELATIONSHIPS_PATH, `${JSON.stringify(relFile, null, 2)}\n`);
  writeFileSync(ASSOCIATIONS_PATH, `${JSON.stringify(associationsFile, null, 2)}\n`);
  writeFileSync(VIEWS_PATH, `${JSON.stringify(viewsFile, null, 2)}\n`);
  writeFileSync(
    ORDERED_COLLECTIONS_PATH,
    `${JSON.stringify(orderedCollectionsFile, null, 2)}\n`,
  );
  console.log("Migration complete.");
}

main();
