import type { GraphDatabase } from "../../graph";
import { TYPE_MEMBERSHIP_TYPES } from "../../labels";
import { priorityWeight } from "../../property-enums";
import { normalizeRelationshipType } from "../../relation-type";
import type { DynamicResolverContext } from "../registry";
import {
  listRelationshipsForComposite,
  otherEndpoint,
} from "../../relationship-traverse";

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
    counts.set(nodeId, countCharacterSceneRelationships(ctx.db, nodeId));
  }
  return counts;
}

function countCharacterSceneRelationships(db: GraphDatabase, nodeId: string): number {
  const compositeCount = listRelationshipsForComposite(db, nodeId, "scenes_characters").length;
  if (compositeCount > 0) return compositeCount;
  return db
    .listRelationshipsFromSource(nodeId)
    .filter((relationship) => normalizeRelationshipType(relationship.type) === "scenes").length;
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
  const scenesLabel = normalizeRelationshipType(String(params.scenes_edge_label ?? "scenes"));
  const productComposite = "scenes_product";

  const characterSceneProducts = new Map<string, Map<string, string[]>>();
  const productIds = new Set<string>();

  for (const nodeId of ctx.rowNodeIds) {
    const sceneMap = new Map<string, string[]>();
    for (const sceneConnection of listRelationshipsForComposite(ctx.db, nodeId, "scenes_characters")) {
      const sceneId = otherEndpoint(sceneConnection, nodeId);
      const products = relatedNodeIdsFromComposite(ctx.db, sceneId, productComposite);
      if (products.length > 0) {
        sceneMap.set(sceneId, products);
        for (const pid of products) productIds.add(pid);
      }
    }
    // Legacy unidirectional SCENES edges (tests / older data)
    for (const sceneConnection of ctx.db.listRelationshipsFromSource(nodeId)) {
      if (normalizeRelationshipType(sceneConnection.type) !== scenesLabel) continue;
      const products = relatedNodeIdsFromComposite(ctx.db, sceneConnection.targetNodeId, productComposite);
      if (products.length === 0) {
        const legacyProducts = ctx.db
          .listRelationshipsFromSource(sceneConnection.targetNodeId)
          .filter((relationship) => normalizeRelationshipType(relationship.type) === "product")
          .map((relationship) => relationship.targetNodeId);
        if (legacyProducts.length > 0) {
          sceneMap.set(sceneConnection.targetNodeId, legacyProducts);
          for (const pid of legacyProducts) productIds.add(pid);
        }
        continue;
      }
      sceneMap.set(sceneConnection.targetNodeId, products);
      for (const pid of products) productIds.add(pid);
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
    const featureConnections = listRelationshipsForComposite(
      ctx.db,
      nodeId,
      "inspirations_features",
    );
    const connections =
      featureConnections.length > 0
        ? featureConnections
        : ctx.db.listRelationshipsFromSource(
            nodeId,
            normalizeRelationshipType(String(params.features_edge_label ?? "features")),
          );
    for (const featConnection of connections) {
      const featureId = otherEndpoint(featConnection, nodeId);
      sum += priorityByFeature.get(featureId) ?? 0;
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
  const themeLabel = normalizeRelationshipType(String(params.theme_edge_label ?? "theme"));
  const themeTargetId = String(params.theme_target_id ?? "");

  const themedFeatures = new Set<string>();
  if (themeTargetId) {
    for (const connection of ctx.db.listRelationshipsToTarget(themeTargetId)) {
      if (normalizeRelationshipType(connection.type) === themeLabel) {
        themedFeatures.add(connection.sourceNodeId);
      }
    }
    for (const connection of ctx.db.listRelationshipsFromSource(themeTargetId, themeLabel)) {
      themedFeatures.add(connection.targetNodeId);
    }
    for (const connection of ctx.db.listRelationshipsFromSource(themeTargetId)) {
      if (normalizeRelationshipType(connection.type) === themeLabel) {
        themedFeatures.add(connection.targetNodeId);
      }
    }
  }

  const counts = new Map<string, number>();
  for (const nodeId of ctx.rowNodeIds) {
    let count = 0;
    const featureConnections = listRelationshipsForComposite(
      ctx.db,
      nodeId,
      "inspirations_features",
    );
    const connections =
      featureConnections.length > 0
        ? featureConnections
        : ctx.db.listRelationshipsFromSource(
            nodeId,
            normalizeRelationshipType(String(params.features_edge_label ?? "features")),
          );
    for (const featConnection of connections) {
      const featureId = otherEndpoint(featConnection, nodeId);
      if (themedFeatures.has(featureId)) count++;
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

function relatedNodeIdsFromComposite(
  db: GraphDatabase,
  nodeId: string,
  compositeType: string,
): string[] {
  return listRelationshipsForComposite(db, nodeId, compositeType).map((relationship) =>
    otherEndpoint(relationship, nodeId),
  );
}
