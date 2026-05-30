import type { GraphDatabase } from "../graph";
import { typeIdsForInstance } from "../node-capabilities";
import { normalizeRelationshipType } from "../relation-type";
import type { RelationshipRuleEntry, SchemaFile } from "./schema-file";

export function allowedTargetTypeIdsForRule(rule: RelationshipRuleEntry): string[] {
  return [...rule.allowedTargetTypeIds];
}

export function resolveRelationshipRule(
  schema: SchemaFile,
  db: GraphDatabase,
  sourceNodeId: string,
  type: string,
): RelationshipRuleEntry | null {
  const normalizedType = normalizeRelationshipType(type);
  const sourceTypes = typeIdsForInstance(db, sourceNodeId);

  for (const rule of schema.relationshipRules) {
    if (rule.type !== normalizedType) continue;
    if (!sourceTypes.includes(rule.sourceTypeId)) continue;
    return rule;
  }
  return null;
}

export function resolveRelationshipRulesForSource(
  schema: SchemaFile,
  db: GraphDatabase,
  sourceNodeId: string,
): RelationshipRuleEntry[] {
  const sourceTypes = typeIdsForInstance(db, sourceNodeId);
  if (sourceTypes.length === 0) return [];

  return schema.relationshipRules.filter((rule) => sourceTypes.includes(rule.sourceTypeId));
}

export interface RelationshipRuleContext {
  ruleId: string;
  type: string;
  allowedTargetTypeIds: string[];
}

export function relationshipRuleContextForType(
  schema: SchemaFile,
  db: GraphDatabase,
  sourceNodeId: string,
  type: string,
): RelationshipRuleContext | null {
  const rule = resolveRelationshipRule(schema, db, sourceNodeId, type);
  if (!rule) return null;
  return {
    ruleId: rule.id,
    type: rule.type,
    allowedTargetTypeIds: allowedTargetTypeIdsForRule(rule),
  };
}

/** @deprecated Use relationshipRuleContextForType */
export const relationshipRuleContextForLabel = relationshipRuleContextForType;
