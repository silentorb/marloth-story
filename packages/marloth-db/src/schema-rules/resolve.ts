import type { GraphDatabase } from "../graph";
import { typeIdsForInstance } from "../node-capabilities";
import type { RelationshipRuleEntry, SchemaFile } from "./schema-file";

export function allowedTargetTypeIdsForRule(rule: RelationshipRuleEntry): string[] {
  return [...rule.allowedTargetTypeIds];
}

export function resolveRelationshipRule(
  schema: SchemaFile,
  db: GraphDatabase,
  sourceNodeId: string,
  label: string,
): RelationshipRuleEntry | null {
  const normalizedLabel = label.trim().toUpperCase();
  const sourceTypes = typeIdsForInstance(db, sourceNodeId);

  for (const rule of schema.relationshipRules) {
    if (rule.label !== normalizedLabel) continue;
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
  label: string;
  allowedTargetTypeIds: string[];
}

export function relationshipRuleContextForLabel(
  schema: SchemaFile,
  db: GraphDatabase,
  sourceNodeId: string,
  label: string,
): RelationshipRuleContext | null {
  const rule = resolveRelationshipRule(schema, db, sourceNodeId, label);
  if (!rule) return null;
  return {
    ruleId: rule.id,
    label: rule.label,
    allowedTargetTypeIds: allowedTargetTypeIdsForRule(rule),
  };
}
