import type { GraphDatabase, Connection, Properties } from "./graph";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterConnectionsWrite } from "./content/write-context";
import { connectionId } from "./graph";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";

/** Synthetic group id for scenes with no Part association. */
export const UNASSIGNED_GROUP_ID = "__unassigned__";

const PRODUCTS_DATABASE_ID = "4e973268d3474f71bd7992094fb39663";

const ORDERED_ASSOCIATION_META_KEYS = new Set([
  "ordinal",
  "via_database",
  "via_view",
  "view",
  "row_index",
  "row_name",
]);

export interface OrderedAssociationConfig {
  id: string;
  typeDatabaseId: string;
  membershipLabel: string;
  orderProperty: string;
  scopeEdgeLabel: string;
  groupEdgeLabel: string;
  /** Optional Part→Scene edge label used when Scene→Part is missing or points at a duplicate part. */
  inverseGroupEdgeLabel?: string;
  groupTypeDatabaseId: string;
  unassignedGroupTitle: string;
}

export interface OrderedAssociationScope {
  id: string;
  name: string;
}

export interface OrderedAssociationRow {
  sceneId: string;
  name: string;
  cells: Record<string, string>;
}

export interface OrderedAssociationGroup {
  groupId: string;
  title: string;
  rows: OrderedAssociationRow[];
}

export interface OrderedAssociationViewDetail {
  configId: string;
  typeDatabaseId: string;
  typeDatabaseTitle: string;
  scopes: OrderedAssociationScope[];
  activeScopeId: string;
  groups: OrderedAssociationGroup[];
  columns: string[];
}

export interface OrderedAssociationMoveParams {
  scopeId: string;
  sceneId: string;
  targetGroupId: string;
  targetIndex: number;
}

const SCENES_BY_BOOK: OrderedAssociationConfig = {
  id: "scenes-by-book",
  typeDatabaseId: "204dba198db74611b0b49a98dd53e8f5",
  membershipLabel: "IS_A",
  orderProperty: "order",
  scopeEdgeLabel: "PRODUCT",
  groupEdgeLabel: "PART",
  inverseGroupEdgeLabel: "SCENES",
  groupTypeDatabaseId: "5e45eefc69a14f45b988ad1f3c9d1ef5",
  unassignedGroupTitle: "Unassigned",
};

const CONFIGS: OrderedAssociationConfig[] = [SCENES_BY_BOOK];

interface MemberInfo {
  sceneId: string;
  name: string;
  order: number;
  partId: string | null;
  membershipConnection: Connection;
  cells: Record<string, string>;
}

function titleFromProperties(properties: Record<string, unknown>): string {
  const title = properties.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  const alias = properties.alias;
  if (typeof alias === "string" && alias.trim()) return alias.trim();
  return "Untitled";
}

function stringProperty(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function numericSortKey(raw: unknown, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cellsFromMembershipConnection(
  config: OrderedAssociationConfig,
  properties: Record<string, unknown>,
): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (ORDERED_ASSOCIATION_META_KEYS.has(key)) continue;
    if (key === config.orderProperty) continue;
    const text = stringProperty(value);
    if (text !== null) cells[key] = text;
  }
  return cells;
}

function getConfig(configId: string): OrderedAssociationConfig | null {
  return CONFIGS.find((config) => config.id === configId) ?? null;
}

export function getOrderedAssociationConfigForDatabase(
  databaseId: string,
): OrderedAssociationConfig | null {
  return CONFIGS.find((config) => config.typeDatabaseId === databaseId) ?? null;
}

function scopeConnectionTarget(db: GraphDatabase, sceneId: string, label: string): string | null {
  const edges = db.listConnectionsFromSource(sceneId, label);
  return edges[0]?.targetNodeId ?? null;
}

function groupConnectionTarget(db: GraphDatabase, sceneId: string, label: string): string | null {
  const edges = db.listConnectionsFromSource(sceneId, label);
  return edges[0]?.targetNodeId ?? null;
}

function membershipConnections(db: GraphDatabase, config: OrderedAssociationConfig): Connection[] {
  return db.listConnectionsToTarget(config.typeDatabaseId, config.membershipLabel);
}

function productSortKey(db: GraphDatabase, productId: string): number {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const edge = db.getConnection(connectionId(productId, label, PRODUCTS_DATABASE_ID));
    if (edge) {
      return numericSortKey(edge.properties.order, numericSortKey(edge.properties.row_index, 999));
    }
  }
  return 999;
}

function partSortKey(db: GraphDatabase, partId: string, config: OrderedAssociationConfig): number {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const edge = db.getConnection(connectionId(partId, label, config.groupTypeDatabaseId));
    if (edge) {
      return numericSortKey(edge.properties.row_index, numericSortKey(edge.properties.order, 999));
    }
  }
  return 999;
}

function partsForScope(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
  scopeId: string,
): { id: string; title: string; sortKey: number }[] {
  const parts: { id: string; title: string; sortKey: number }[] = [];

  for (const label of TYPE_MEMBERSHIP_LABELS) {
    for (const connection of db.listConnectionsToTarget(config.groupTypeDatabaseId, label)) {
      const partId = connection.sourceNodeId;
      const productConnections = db.listConnectionsFromSource(partId, "PRODUCTS");
      if (!productConnections.some((productConnection) => productConnection.targetNodeId === scopeId)) continue;

      const vertex = db.getNode(partId);
      parts.push({
        id: partId,
        title: vertex ? titleFromProperties(vertex.properties) : "Untitled",
        sortKey: partSortKey(db, partId, config),
      });
    }
  }

  const byId = new Map<string, { id: string; title: string; sortKey: number }>();
  for (const part of parts) byId.set(part.id, part);
  return [...byId.values()].sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

function canonicalPartIdForTitle(
  scopeParts: { id: string; title: string }[],
  title: string,
): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;
  const match = scopeParts.find((part) => part.title.trim().toLowerCase() === normalized);
  return match?.id ?? null;
}

/** Resolve which scope part a scene belongs to, tolerating duplicate part vertices from import. */
function resolveScenePartId(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
  sceneId: string,
  scopeParts: { id: string; title: string }[],
): string | null {
  const scopePartIds = new Set(scopeParts.map((part) => part.id));
  const partConnectionTarget = groupConnectionTarget(db, sceneId, config.groupEdgeLabel);

  if (partConnectionTarget) {
    if (scopePartIds.has(partConnectionTarget)) return partConnectionTarget;

    const partVertex = db.getNode(partConnectionTarget);
    if (partVertex) {
      const canonicalId = canonicalPartIdForTitle(
        scopeParts,
        titleFromProperties(partVertex.properties),
      );
      if (canonicalId) return canonicalId;
    }
  }

  if (config.inverseGroupEdgeLabel) {
    for (const part of scopeParts) {
      const containsScene = db
        .listConnectionsFromSource(part.id, config.inverseGroupEdgeLabel)
        .some((edge) => edge.targetNodeId === sceneId);
      if (containsScene) return part.id;
    }
  }

  return null;
}

function collectMembersInScope(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
  scopeId: string,
): MemberInfo[] {
  const scopeParts = partsForScope(db, config, scopeId);
  const members: MemberInfo[] = [];
  let fallbackOrder = 0;

  for (const connection of membershipConnections(db, config)) {
    const sceneId = connection.sourceNodeId;
    const productId = scopeConnectionTarget(db, sceneId, config.scopeEdgeLabel);
    if (productId !== scopeId) continue;

    const vertex = db.getNode(sceneId);
    const partId = resolveScenePartId(db, config, sceneId, scopeParts);
    fallbackOrder += 10;

    members.push({
      sceneId,
      name: vertex ? titleFromProperties(vertex.properties) : "Untitled",
      order: numericSortKey(connection.properties[config.orderProperty], fallbackOrder),
      partId,
      membershipConnection: connection,
      cells: cellsFromMembershipConnection(config, connection.properties),
    });
  }

  members.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return members;
}

function buildGroups(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
  scopeId: string,
  members: MemberInfo[],
): OrderedAssociationGroup[] {
  const parts = partsForScope(db, config, scopeId);
  const membersByPart = new Map<string | null, MemberInfo[]>();

  for (const member of members) {
    const key = member.partId;
    const group = membersByPart.get(key) ?? [];
    group.push(member);
    membersByPart.set(key, group);
  }

  const groups: OrderedAssociationGroup[] = [];

  for (const part of parts) {
    const rows = (membersByPart.get(part.id) ?? []).map(memberToRow);
    groups.push({ groupId: part.id, title: part.title, rows });
    membersByPart.delete(part.id);
  }

  const unassignedMembers = membersByPart.get(null) ?? [];
  for (const [partId, orphaned] of membersByPart) {
    if (partId !== null) {
      unassignedMembers.push(...orphaned);
    }
  }

  groups.push({
    groupId: UNASSIGNED_GROUP_ID,
    title: config.unassignedGroupTitle,
    rows: unassignedMembers.map(memberToRow),
  });

  return groups;
}

function memberToRow(member: MemberInfo): OrderedAssociationRow {
  return { sceneId: member.sceneId, name: member.name, cells: member.cells };
}

function collectColumns(members: MemberInfo[]): string[] {
  const columnSet = new Set<string>();
  for (const member of members) {
    for (const key of Object.keys(member.cells)) columnSet.add(key);
  }
  return [...columnSet].sort((a, b) => a.localeCompare(b));
}

function discoverScopes(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
): OrderedAssociationScope[] {
  const scopeIds = new Set<string>();

  for (const connection of membershipConnections(db, config)) {
    const productId = scopeConnectionTarget(db, connection.sourceNodeId, config.scopeEdgeLabel);
    if (productId) scopeIds.add(productId);
  }

  const scopes: OrderedAssociationScope[] = [];
  for (const id of scopeIds) {
    const vertex = db.getNode(id);
    scopes.push({
      id,
      name: vertex ? titleFromProperties(vertex.properties) : "Untitled",
    });
  }

  scopes.sort((a, b) => {
    const keyA = productSortKey(db, a.id);
    const keyB = productSortKey(db, b.id);
    if (keyA !== keyB) return keyA - keyB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return scopes;
}

export function getOrderedAssociationView(
  db: GraphDatabase,
  configId: string,
  requestedScopeId?: string,
): OrderedAssociationViewDetail | null {
  const config = getConfig(configId);
  if (!config) return null;

  const database = db.getNode(config.typeDatabaseId);
  if (!database) return null;

  const scopes = discoverScopes(db, config);
  const activeScopeId =
    requestedScopeId && scopes.some((scope) => scope.id === requestedScopeId)
      ? requestedScopeId
      : (scopes[0]?.id ?? "");

  const members = activeScopeId ? collectMembersInScope(db, config, activeScopeId) : [];
  const groups = activeScopeId
    ? buildGroups(db, config, activeScopeId, members)
    : [];

  return {
    configId: config.id,
    typeDatabaseId: config.typeDatabaseId,
    typeDatabaseTitle: titleFromProperties(database.properties),
    scopes,
    activeScopeId,
    groups,
    columns: collectColumns(members),
  };
}

function flattenGroupRows(groups: OrderedAssociationGroup[]): string[] {
  const sceneIds: string[] = [];
  for (const group of groups) {
    for (const row of group.rows) {
      sceneIds.push(row.sceneId);
    }
  }
  return sceneIds;
}

function groupsFromMembers(
  db: GraphDatabase,
  config: OrderedAssociationConfig,
  scopeId: string,
  members: MemberInfo[],
): OrderedAssociationGroup[] {
  return buildGroups(db, config, scopeId, members);
}

function applyMoveToGroups(
  groups: OrderedAssociationGroup[],
  sceneId: string,
  targetGroupId: string,
  targetIndex: number,
): OrderedAssociationGroup[] {
  const nextGroups = groups.map((group) => ({
    ...group,
    rows: [...group.rows],
  }));

  let movedRow: OrderedAssociationRow | null = null;

  for (const group of nextGroups) {
    const index = group.rows.findIndex((row) => row.sceneId === sceneId);
    if (index >= 0) {
      movedRow = group.rows.splice(index, 1)[0] ?? null;
      break;
    }
  }

  if (!movedRow) return groups;

  const targetGroup = nextGroups.find((group) => group.groupId === targetGroupId);
  if (!targetGroup) return groups;

  const safeIndex = Math.max(0, Math.min(targetIndex, targetGroup.rows.length));
  targetGroup.rows.splice(safeIndex, 0, movedRow);

  return nextGroups;
}

export function applyOrderedAssociationMove(
  ctx: MarlothWriteContext,
  configId: string,
  params: OrderedAssociationMoveParams,
): OrderedAssociationViewDetail | null {
  const db = ctx.db;
  const config = getConfig(configId);
  if (!config) return null;

  const members = collectMembersInScope(db, config, params.scopeId);
  if (!members.some((member) => member.sceneId === params.sceneId)) return null;

  const groups = groupsFromMembers(db, config, params.scopeId, members);
  const nextGroups = applyMoveToGroups(
    groups,
    params.sceneId,
    params.targetGroupId,
    params.targetIndex,
  );

  const orderedSceneIds = flattenGroupRows(nextGroups);
  const memberById = new Map(members.map((member) => [member.sceneId, member]));

  for (let index = 0; index < orderedSceneIds.length; index++) {
    const sceneId = orderedSceneIds[index]!;
    const member = memberById.get(sceneId);
    if (!member) continue;

    const newOrder = (index + 1) * 10;
    const membershipProps = {
      ...member.membershipConnection.properties,
      [config.orderProperty]: String(newOrder),
    };
    ctx.store.mergeConnectionProperties(
      member.membershipConnection.sourceNodeId,
      member.membershipConnection.targetNodeId,
      member.membershipConnection.label,
      membershipProps,
    );
  }

  const currentPartId = resolveScenePartId(
    db,
    config,
    params.sceneId,
    partsForScope(db, config, params.scopeId),
  );
  const targetPartId =
    params.targetGroupId === UNASSIGNED_GROUP_ID ? null : params.targetGroupId;

  if (currentPartId !== targetPartId) {
    const existingPartConnections = db.listConnectionsFromSource(params.sceneId, config.groupEdgeLabel);
    for (const connection of existingPartConnections) {
      ctx.store.deleteConnection(
        connection.sourceNodeId,
        connection.targetNodeId,
        connection.label,
      );
    }

    if (targetPartId) {
      const templateProps = existingPartConnections[0]?.properties ?? {};
      const partProps: Properties = {};
      for (const [key, value] of Object.entries(templateProps)) {
        if (key === "ordinal") continue;
        partProps[key] = value;
      }
      ctx.store.upsertConnection(params.sceneId, targetPartId, config.groupEdgeLabel, partProps);
    }
  }

  syncAfterConnectionsWrite(ctx);
  return getOrderedAssociationView(db, configId, params.scopeId);
}
