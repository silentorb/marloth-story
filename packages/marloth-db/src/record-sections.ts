import type { GraphDatabase, EdgeRecord } from "./graph";
import { getDatabaseViewDetail, type DatabaseColumnDef, type DatabaseViewDetail } from "./database-view";
import { coalescePriorityValue, enrichColumnDefs, isPriorityColumnKey } from "./property-enums";
import { IS_A_LABEL, isTypeMembershipLabel, LEGACY_IN_DATABASE_LABEL } from "./labels";
import {
  getOrderedAssociationConfigForDatabase,
  getOrderedAssociationView,
  type OrderedAssociationViewDetail,
} from "./ordered-associations";
import { getRecordDetail, type RecordDetail } from "./queries";
import { getRecordPageMetadata, type RecordPageMetadata } from "./record-metadata";
import { buildPropertiesSection, type PropertiesSection } from "./page-properties";

const RELATION_META_KEYS = new Set([
  "ordinal",
  "via_database",
  "via_view",
  "view",
  "row_index",
  "row_name",
]);

export interface MarkdownSection {
  type: "markdown";
  body: string;
}

export interface DatabaseTableSection {
  type: "database";
  databaseView: DatabaseViewDetail;
}

export interface OrderedAssociationSection {
  type: "ordered-association";
  configId: string;
  view: OrderedAssociationViewDetail;
}

export interface RelationRow {
  targetId: string;
  name: string;
  path: string | null;
  cells: Record<string, string>;
}

export interface RelationTableSection {
  type: "relations";
  label: string;
  title: string;
  /** When set, the section title links to this type (NotionDatabase) record. */
  typeRecordId: string | null;
  columns: string[];
  columnDefs?: DatabaseColumnDef[];
  rows: RelationRow[];
}

export type RecordSection = MarkdownSection | DatabaseTableSection | OrderedAssociationSection | RelationTableSection;

export interface RecordPageDetail extends RecordDetail {
  metadata: RecordPageMetadata;
  properties: PropertiesSection | null;
  sections: RecordSection[];
}

export type { PropertiesSection } from "./page-properties";

export type { RecordBacklink, RecordPageMetadata } from "./record-metadata";

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

function pathFromProperties(properties: Record<string, unknown>): string | null {
  const path = properties.inferred_notion_path;
  return typeof path === "string" && path.trim() ? path.trim() : null;
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cellsFromEdgeProperties(properties: Record<string, unknown>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (RELATION_META_KEYS.has(key)) continue;
    const text = stringProperty(value);
    if (text !== null) cells[key] = text;
  }
  return cells;
}

function labelToSectionTitle(label: string): string {
  return label
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function relationLabelSortKey(label: string): string {
  if (isTypeMembershipLabel(label)) return "z:is_a";
  return `a:${label}`;
}

function ordinalFromProperties(properties: Record<string, unknown>): number {
  const raw = properties.ordinal;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function normalizeRelationGroupLabel(label: string): string {
  if (label === LEGACY_IN_DATABASE_LABEL) return IS_A_LABEL;
  return label;
}

function findNotionDatabaseByTitle(db: GraphDatabase, title: string): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const vertex of db.listVerticesForGraphExport()) {
    if (!vertex.labels.includes("NotionDatabase")) continue;
    if (vertex.title.trim().toLowerCase() === normalized) return vertex.id;
  }
  return null;
}

function resolveViaDatabase(edges: EdgeRecord[]): string | null {
  const ids = edges
    .map((edge) => stringProperty(edge.properties.via_database))
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return null;
  const first = ids[0]!;
  return ids.every((id) => id === first) ? first : null;
}

function resolveTypeRecordId(
  db: GraphDatabase,
  label: string,
  edges: EdgeRecord[],
): string | null {
  if (label === IS_A_LABEL) {
    const viaDatabase = resolveViaDatabase(edges);
    if (viaDatabase) {
      const vertex = db.getVertex(viaDatabase);
      if (vertex?.labels.includes("NotionDatabase")) return viaDatabase;
    }
    const targetIds = [...new Set(edges.map((edge) => edge.targetId))];
    if (targetIds.length === 1) return targetIds[0]!;
  }

  return findNotionDatabaseByTitle(db, labelToSectionTitle(label));
}

function sectionTitleForType(
  db: GraphDatabase,
  label: string,
  typeRecordId: string | null,
): string {
  if (typeRecordId) {
    const typeVertex = db.getVertex(typeRecordId);
    if (typeVertex) return titleFromProperties(typeVertex.properties);
  }
  return labelToSectionTitle(label);
}

function buildRelationSections(db: GraphDatabase, recordId: string): RelationTableSection[] {
  const outgoing = db.listEdgesFromSource(recordId);
  const byLabel = new Map<string, typeof outgoing>();

  for (const edge of outgoing) {
    const groupLabel = normalizeRelationGroupLabel(edge.label);
    const group = byLabel.get(groupLabel) ?? [];
    group.push(edge);
    byLabel.set(groupLabel, group);
  }

  const sections: RelationTableSection[] = [];

  for (const label of [...byLabel.keys()].sort((a, b) =>
    relationLabelSortKey(a).localeCompare(relationLabelSortKey(b)),
  )) {
    const edges = byLabel.get(label)!;
    const columnSet = new Set<string>();
    const rows: RelationRow[] = [];

    for (const edge of edges) {
      const target = db.getVertex(edge.targetId);
      const cells = cellsFromEdgeProperties(edge.properties);
      for (const key of Object.keys(cells)) columnSet.add(key);

      rows.push({
        targetId: edge.targetId,
        name: target ? titleFromProperties(target.properties) : "Untitled",
        path: target ? pathFromProperties(target.properties) : null,
        cells,
      });
    }

    rows.sort((a, b) => {
      const edgeA = edges.find((edge) => edge.targetId === a.targetId);
      const edgeB = edges.find((edge) => edge.targetId === b.targetId);
      const ordA = edgeA ? ordinalFromProperties(edgeA.properties) : Number.MAX_SAFE_INTEGER;
      const ordB = edgeB ? ordinalFromProperties(edgeB.properties) : Number.MAX_SAFE_INTEGER;
      if (ordA !== ordB) return ordA - ordB;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const typeRecordId = resolveTypeRecordId(db, label, edges);
    const columns = [...columnSet].sort((a, b) => a.localeCompare(b));
    if (columns.includes("priority")) {
      for (const row of rows) {
        row.cells.priority = coalescePriorityValue(row.cells.priority);
      }
    }
    const columnDefs = enrichColumnDefs(
      columns.map((key) => ({
        key,
        name: isPriorityColumnKey(key)
          ? "Priority"
          : key
              .split("_")
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" "),
        type: "text",
      })),
    );

    sections.push({
      type: "relations",
      label,
      title: sectionTitleForType(db, label, typeRecordId),
      typeRecordId,
      columns,
      columnDefs,
      rows,
    });
  }

  return sections;
}

/** Build a universal page view: markdown first, then database and relation table sections. */
export function getRecordPageDetail(
  db: GraphDatabase,
  id: string,
  options?: { databaseView?: string; scopeId?: string },
): RecordPageDetail | null {
  const record = getRecordDetail(db, id);
  if (!record) return null;

  const sections: RecordSection[] = [{ type: "markdown", body: record.body }];

  if (record.labels.includes("NotionDatabase")) {
    const orderedConfig = getOrderedAssociationConfigForDatabase(id);
    if (orderedConfig) {
      const orderedView = getOrderedAssociationView(db, orderedConfig.id, options?.scopeId);
      if (orderedView) {
        sections.push({
          type: "ordered-association",
          configId: orderedConfig.id,
          view: orderedView,
        });
      }
    } else {
      const databaseSection = getDatabaseViewDetail(db, id, options?.databaseView);
      if (databaseSection) {
        sections.push({ type: "database", databaseView: databaseSection });
      }
    }
  }

  sections.push(...buildRelationSections(db, id));

  const properties =
    record.labels.includes("NotionDatabase") ? null : buildPropertiesSection(db, id);

  const metadata = getRecordPageMetadata(db, id)!;

  const finalSections = properties
    ? sections.filter(
        (section) => !(section.type === "relations" && section.label === IS_A_LABEL),
      )
    : sections;

  return { ...record, metadata, properties, sections: finalSections };
}
