import type { GraphDatabase } from "../graph";
import { TYPE_MEMBERSHIP_LABELS } from "../../labels";
import { priorityWeight } from "../../property-enums";
import type { DynamicResolverContext } from "./registry";

export { priorityWeight, PRIORITY_WEIGHT } from "../../property-enums";

function titleFromVertex(db: GraphDatabase, id: string): string {
  const vertex = db.getVertex(id);
  const title = vertex?.properties.title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled";
}

/** Prefetch: pageId -> count of SCENES edges */
export function buildAllSceneCountPrefetch(ctx: DynamicResolverContext): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pageId of ctx.rowPageIds) {
    counts.set(pageId, dbCountEdges(ctx.db, pageId, "SCENES"));
  }
  return counts;
}

function dbCountEdges(db: GraphDatabase, sourceId: string, label: string): number {
  return db.listEdgesFromSource(sourceId, label).length;
}

export function resolveAllSceneCount(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  pageId: string,
  prefetch: unknown,
): string {
  const counts = prefetch as Map<string, number>;
  return String(counts.get(pageId) ?? 0);
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
  const productLabel = String(params.product_edge_label ?? "PRODUCT");

  const characterSceneProducts = new Map<string, Map<string, string[]>>();
  const productIds = new Set<string>();

  for (const pageId of ctx.rowPageIds) {
    const sceneMap = new Map<string, string[]>();
    for (const sceneEdge of ctx.db.listEdgesFromSource(pageId, scenesLabel)) {
      const products = ctx.db
        .listEdgesFromSource(sceneEdge.targetId, productLabel)
        .map((e) => e.targetId);
      if (products.length > 0) {
        sceneMap.set(sceneEdge.targetId, products);
        for (const pid of products) productIds.add(pid);
      }
    }
    characterSceneProducts.set(pageId, sceneMap);
  }

  const dimensions = [...productIds]
    .map((id) => ({ id, title: titleFromVertex(ctx.db, id) }))
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
  pageId: string,
  productId: string,
  prefetch: unknown,
): string {
  const data = prefetch as SceneCountByProductPrefetch;
  const sceneMap = data.characterSceneProducts.get(pageId);
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
  const featuresLabel = String(params.features_edge_label ?? "FEATURES");
  const featuresDbId = String(params.features_database_id ?? "");

  const priorityByFeature = new Map<string, number>();
  if (featuresDbId) {
    for (const label of TYPE_MEMBERSHIP_LABELS) {
      for (const edge of ctx.db.listEdgesToTarget(featuresDbId, label)) {
        priorityByFeature.set(edge.sourceId, priorityWeight(edge.properties.priority));
      }
    }
  }

  const sums = new Map<string, number>();
  for (const pageId of ctx.rowPageIds) {
    let sum = 0;
    for (const featEdge of ctx.db.listEdgesFromSource(pageId, featuresLabel)) {
      sum += priorityByFeature.get(featEdge.targetId) ?? 0;
    }
    sums.set(pageId, sum);
  }
  return { sums };
}

export function resolveWeightedUse(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  pageId: string,
  prefetch: unknown,
): string {
  const data = prefetch as WeightedUsePrefetch;
  return String(data.sums.get(pageId) ?? 0);
}

export interface WonderPrefetch {
  /** inspirationId -> count */
  counts: Map<string, number>;
}

export function buildWonderPrefetch(
  ctx: DynamicResolverContext,
  params: Record<string, unknown>,
): WonderPrefetch {
  const featuresLabel = String(params.features_edge_label ?? "FEATURES");
  const themeLabel = String(params.theme_edge_label ?? "THEME");
  const themeTargetId = String(params.theme_target_id ?? "");

  const themedFeatures = new Set<string>();
  if (themeTargetId) {
    for (const edge of ctx.db.listEdgesToTarget(themeTargetId)) {
      if (edge.label === themeLabel) themedFeatures.add(edge.sourceId);
    }
  }

  const counts = new Map<string, number>();
  for (const pageId of ctx.rowPageIds) {
    let count = 0;
    for (const featEdge of ctx.db.listEdgesFromSource(pageId, featuresLabel)) {
      if (themedFeatures.has(featEdge.targetId)) count++;
    }
    counts.set(pageId, count);
  }
  return { counts };
}

export function resolveWonder(
  _ctx: DynamicResolverContext,
  _params: Record<string, unknown>,
  pageId: string,
  prefetch: unknown,
): string {
  const data = prefetch as WonderPrefetch;
  return String(data.counts.get(pageId) ?? 0);
}
