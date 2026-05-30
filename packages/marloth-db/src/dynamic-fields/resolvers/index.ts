import type { GraphDatabase } from "../../graph";
import { TYPE_MEMBERSHIP_TYPES } from "../../labels";
import { priorityWeight } from "../../property-enums";
import type { DynamicResolverContext } from "../registry";

export { priorityWeight, PRIORITY_WEIGHT } from "../../property-enums";

function titleFromNode(db: GraphDatabase, id: string): string {
  const node = db.getNode(id);
  const title = node?.properties.title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled";
}

/** Prefetch: nodeId -> count of SCENES relationships */
export function buildAllSceneCountPrefetch(ctx: DynamicResolverContext): Map<string, number> {
  const counts = new Map<string, number>();
  for (const nodeId of ctx.rowNodeIds) {
    counts.set(nodeId, dbCountConnections(ctx.db, nodeId, "SCENES"));
  }
  return counts;
}

function dbCountConnections(db: GraphDatabase, sourceNodeId: string, label: string): number {
  return db.listRelationshipsFromSource(sourceNodeId, label).length;
}

export function resolveAllSceneCount(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  nodeId: string,
  prefetch: unknown,
): string {
  const counts = prefetch as Map<string, number>;
  return String(counts.get(nodeId) ?? 0);
}

export interface SceneCountByProductPrefetch {
  /** characterId -> sceneId -> productId[] */
  characterSceneProducts: Map<string, Map<string, string[]>>;
  dimensions: { id: string; title: string }[];
}

export function buildSceneCountByProductPrefetch(
  ctx: DynamicResolverContext,
  params: Record<string, unknown>,
): SceneCountByProductPrefetch {
  const scenesLabel = String(params.scenes_edge_label ?? "SCENES");
  const productLabel = String(params.product_edge_label ?? "product");

  const characterSceneProducts = new Map<string, Map<string, string[]>>();
  const productIds = new Set<string>();

  for (const nodeId of ctx.rowNodeIds) {
    const sceneMap = new Map<string, string[]>();
    for (const sceneConnection of ctx.db.listRelationshipsFromSource(nodeId, scenesLabel)) {
      const products = ctx.db
        .listRelationshipsFromSource(sceneConnection.targetNodeId, productLabel)
        .map((c) => c.targetNodeId);
      if (products.length > 0) {
        sceneMap.set(sceneConnection.targetNodeId, products);
        for (const pid of products) productIds.add(pid);
      }
    }
    characterSceneProducts.set(nodeId, sceneMap);
  }

  const dimensions = [...productIds]
    .map((id) => ({ id, title: titleFromNode(ctx.db, id) }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  return { characterSceneProducts, dimensions };
}

export function discoverSceneCountByProductDimensions(
  ctx: DynamicResolverContext,
  params: Record<string, unknown>,
): { id: string; title: string }[] {
  return buildSceneCountByProductPrefetch(ctx, params).dimensions;
}

export function resolveSceneCountByProduct(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  nodeId: string,
  productId: string,
  prefetch: unknown,
): string {
  const data = prefetch as SceneCountByProductPrefetch;
  const sceneMap = data.characterSceneProducts.get(nodeId);
  if (!sceneMap) return "0";
  let count = 0;
  for (const products of sceneMap.values()) {
    if (products.includes(productId)) count++;
  }
  return String(count);
}

export interface WeightedUsePrefetch {
  /** inspirationId -> sum */
  sums: Map<string, number>;
}

export function buildWeightedUsePrefetch(
  ctx: DynamicResolverContext,
  params: Record<string, unknown>,
): WeightedUsePrefetch {
  const featuresLabel = String(params.features_edge_label ?? "features");
  const featuresDbId = String(params.features_database_id ?? "");

  const priorityByFeature = new Map<string, number>();
  if (featuresDbId) {
    for (const type of TYPE_MEMBERSHIP_TYPES) {
      for (const connection of ctx.db.listRelationshipsToTarget(featuresDbId, type)) {
        priorityByFeature.set(connection.sourceNodeId, priorityWeight(connection.properties.priority));
      }
    }
  }

  const sums = new Map<string, number>();
  for (const nodeId of ctx.rowNodeIds) {
    let sum = 0;
    for (const featConnection of ctx.db.listRelationshipsFromSource(nodeId, featuresLabel)) {
      sum += priorityByFeature.get(featConnection.targetNodeId) ?? 0;
    }
    sums.set(nodeId, sum);
  }
  return { sums };
}

export function resolveWeightedUse(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  nodeId: string,
  prefetch: unknown,
): string {
  const data = prefetch as WeightedUsePrefetch;
  return String(data.sums.get(nodeId) ?? 0);
}

export interface WonderPrefetch {
  /** inspirationId -> count */
  counts: Map<string, number>;
}

export function buildWonderPrefetch(
  ctx: DynamicResolverContext,
  params: Record<string, unknown>,
): WonderPrefetch {
  const featuresLabel = String(params.features_edge_label ?? "features");
  const themeLabel = String(params.theme_edge_label ?? "THEME");
  const themeTargetId = String(params.theme_target_id ?? "");

  const themedFeatures = new Set<string>();
  if (themeTargetId) {
    for (const connection of ctx.db.listRelationshipsToTarget(themeTargetId)) {
      if (connection.type === themeLabel) themedFeatures.add(connection.sourceNodeId);
    }
  }

  const counts = new Map<string, number>();
  for (const nodeId of ctx.rowNodeIds) {
    let count = 0;
    for (const featConnection of ctx.db.listRelationshipsFromSource(nodeId, featuresLabel)) {
      if (themedFeatures.has(featConnection.targetNodeId)) count++;
    }
    counts.set(nodeId, count);
  }
  return { counts };
}

export function resolveWonder(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  nodeId: string,
  prefetch: unknown,
): string {
  const data = prefetch as WonderPrefetch;
  return String(data.counts.get(nodeId) ?? 0);
}
