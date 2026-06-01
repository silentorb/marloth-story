import type { GraphDatabase, Relationship } from "./graph";
import { getDatabaseViewDetail, type DatabaseColumnDef, type DatabaseViewDetail } from "./database-view";
import { coalescePriorityValue, enrichColumnDefs, isPriorityColumnKey } from "./property-enums";
import { IS_A_TYPE, isTypeMembershipType, LEGACY_IN_DATABASE_TYPE } from "./labels";
import {
  getConfigByProvider,
  getOrderedAssociationView,
  type OrderedAssociationViewDetail,
} from "./ordered-associations";
import { getNodeDetail, type NodeDetail } from "./queries";
import { getNodePageMetadata, type NodePageMetadata } from "./node-metadata";
import { buildPropertiesSection, type PropertiesSection } from "./node-type-properties";
import { findTypeNodeByTitle, isTypeTableNode } from "./node-capabilities";
import { relationshipRuleContextForType } from "./schema-rules/resolve";
import type { SchemaFile } from "./schema-rules/schema-file";
import { resolveContentPath } from "./content/paths";
import { formatRelationshipTypeLabel } from "./relationship-type-label";
import { generatedProviderId, ITEMS_SECTION_KEY } from "./views/resolve-tabs";
import { loadViewsFromContent } from "./views/load";

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
  /** When set, the section title links to this type node. */
  typeNodeId: string | null;
  /** UI hint: allowed IS_A target type ids for new linked nodes (from schema.json). */
  allowedTargetTypeIds?: string[];
  columns: string[];
  columnDefs?: DatabaseColumnDef[];
  rows: RelationRow[];
}

export type NodeSection = MarkdownSection | DatabaseTableSection | OrderedAssociationSection | RelationTableSection;

export interface NodePageDetail extends NodeDetail {
  metadata: NodePageMetadata;
  properties: PropertiesSection | null;
  sections: NodeSection[];
}

export type { PropertiesSection } from "./node-type-properties";

export type { NodeBacklink, NodePageMetadata } from "./node-metadata";

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

function cellsFromConnectionProperties(properties: Record<string, unknown>): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (RELATION_META_KEYS.has(key)) continue;
    const text = stringProperty(value);
    if (text !== null) cells[key] = text;
  }
  return cells;
}

function relationTypeSortKey(type: string): string {
  if (isTypeMembershipType(type)) return "z:is_a";
  return `a:${type}`;
}

function ordinalFromProperties(properties: Record<string, unknown>): number {
  const raw = properties.ordinal;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function normalizeRelationGroupType(type: string): string {
  if (type === LEGACY_IN_DATABASE_TYPE) return IS_A_TYPE;
  return type;
}

function resolveViaDatabase(connections: Relationship[]): string | null {
  const ids = connections
    .map((connection) => stringProperty(connection.properties.via_database))
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return null;
  const first = ids[0]!;
  return ids.every((id) => id === first) ? first : null;
}

function resolveTypeNodeId(
  db: GraphDatabase,
  relationshipType: string,
  connections: Relationship[],
): string | null {
  if (relationshipType === IS_A_TYPE) {
    const viaDatabase = resolveViaDatabase(connections);
    if (viaDatabase) {
      if (isTypeTableNode(db, viaDatabase)) return viaDatabase;
    }
    const targetIds = [...new Set(connections.map((connection) => connection.targetNodeId))];
    if (targetIds.length === 1) return targetIds[0]!;
  }

  return findTypeNodeByTitle(db, formatRelationshipTypeLabel(relationshipType));
}

function sectionTitleForType(
  db: GraphDatabase,
  label: string,
  typeNodeId: string | null,
): string {
  if (typeNodeId) {
    const typeNode = db.getNode(typeNodeId);
    if (typeNode) return titleFromProperties(typeNode.properties);
  }
  return formatRelationshipTypeLabel(label);
}

function buildRelationSections(
  db: GraphDatabase,
  nodeId: string,
  schema?: SchemaFile,
): RelationTableSection[] {
  const outgoing = db.listRelationshipsFromSource(nodeId);
  const byType = new Map<string, typeof outgoing>();

  for (const connection of outgoing) {
    const groupType = normalizeRelationGroupType(connection.type);
    const group = byType.get(groupType) ?? [];
    group.push(connection);
    byType.set(groupType, group);
  }

  const sections: RelationTableSection[] = [];

  for (const label of [...byType.keys()].sort((a, b) =>
    relationTypeSortKey(a).localeCompare(relationTypeSortKey(b)),
  )) {
    const connections = byType.get(label)!;
    const columnSet = new Set<string>();
    const rows: RelationRow[] = [];

    for (const connection of connections) {
      const target = db.getNode(connection.targetNodeId);
      const cells = cellsFromConnectionProperties(connection.properties);
      for (const key of Object.keys(cells)) columnSet.add(key);

      rows.push({
        targetId: connection.targetNodeId,
        name: target ? titleFromProperties(target.properties) : "Untitled",
        path: target ? pathFromProperties(target.properties) : null,
        cells,
      });
    }

    rows.sort((a, b) => {
      const connA = connections.find((connection) => connection.targetNodeId === a.targetId);
      const connB = connections.find((connection) => connection.targetNodeId === b.targetId);
      const ordA = connA ? ordinalFromProperties(connA.properties) : Number.MAX_SAFE_INTEGER;
      const ordB = connB ? ordinalFromProperties(connB.properties) : Number.MAX_SAFE_INTEGER;
      if (ordA !== ordB) return ordA - ordB;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const typeNodeId = resolveTypeNodeId(db, label, connections);
    const ruleContext =
      schema && !isTypeMembershipType(label)
        ? relationshipRuleContextForType(schema, db, nodeId, label)
        : null;
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
      title: sectionTitleForType(db, label, typeNodeId),
      typeNodeId,
      allowedTargetTypeIds: ruleContext?.allowedTargetTypeIds,
      columns,
      columnDefs,
      rows,
    });
  }

  return sections;
}

/** Build a universal node page view: markdown first, then database and relation table sections. */
export function getNodePageDetail(
  db: GraphDatabase,
  id: string,
  options?: {
    /** Active table tab id (custom or generated). */
    tabId?: string;
    /** @deprecated Use tabId */
    databaseView?: string;
    /** @deprecated Use tabId */
    scopeId?: string;
    schema?: SchemaFile;
    contentDir?: string;
  },
): NodePageDetail | null {
  const node = getNodeDetail(db, id);
  if (!node) return null;

  const contentDir = options?.contentDir ?? resolveContentPath();
  const tabId = options?.tabId ?? options?.scopeId ?? options?.databaseView;
  const views = loadViewsFromContent(contentDir);

  const sections: NodeSection[] = [{ type: "markdown", body: node.body }];

  if (node.isTypeTable) {
    const provider = generatedProviderId(views, id, ITEMS_SECTION_KEY);
    if (provider) {
      const config = getConfigByProvider(provider);
      if (config) {
        const orderedView = getOrderedAssociationView(db, config.id, tabId, contentDir);
        if (orderedView) {
          sections.push({
            type: "ordered-association",
            configId: config.id,
            view: orderedView,
          });
        }
      }
    } else {
      const databaseSection = getDatabaseViewDetail(db, id, tabId, contentDir);
      if (databaseSection) {
        sections.push({ type: "database", databaseView: databaseSection });
      }
    }
  }

  sections.push(...buildRelationSections(db, id, options?.schema));

  const properties = node.isTypeTable ? null : buildPropertiesSection(db, id);

  const metadata = getNodePageMetadata(db, id)!;

  const finalSections = properties
    ? sections.filter(
        (section) => !(section.type === "relations" && section.label === IS_A_TYPE),
      )
    : sections;

  return { ...node, metadata, properties, sections: finalSections };
}
