import { normalizeRelationshipType } from "../relation-type";

export const SCHEMA_FILE_VERSION = 1;

export interface RelationshipRuleEntry {
  id: string;
  sourceTypeId: string;
  type: string;
  allowedTargetTypeIds: string[];
}

export interface SchemaFile {
  version: number;
  relationshipRules: RelationshipRuleEntry[];
}

export function emptySchemaFile(): SchemaFile {
  return { version: SCHEMA_FILE_VERSION, relationshipRules: [] };
}

export function parseSchemaFile(raw: string): SchemaFile {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("schema.json: root must be an object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "number") {
    throw new Error("schema.json: version is required");
  }
  if (!Array.isArray(obj.relationshipRules)) {
    throw new Error("schema.json: relationshipRules must be an array");
  }

  const relationshipRules: RelationshipRuleEntry[] = [];
  for (const entry of obj.relationshipRules) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("schema.json: each relationship rule must be an object");
    }
    const rule = entry as Record<string, unknown>;
    if (typeof rule.id !== "string" || !rule.id.trim()) {
      throw new Error("schema.json: relationship rule id is required");
    }
    if (typeof rule.sourceTypeId !== "string" || !rule.sourceTypeId.trim()) {
      throw new Error(`schema.json: relationship rule ${rule.id} sourceTypeId is required`);
    }
    const rawType = rule.type ?? rule.label;
    if (typeof rawType !== "string" || !rawType.trim()) {
      throw new Error(`schema.json: relationship rule ${rule.id} type is required`);
    }
    if (!Array.isArray(rule.allowedTargetTypeIds)) {
      throw new Error(`schema.json: relationship rule ${rule.id} allowedTargetTypeIds must be an array`);
    }
    relationshipRules.push({
      id: rule.id.trim(),
      sourceTypeId: rule.sourceTypeId.trim().toLowerCase(),
      type: normalizeRelationshipType(rawType),
      allowedTargetTypeIds: rule.allowedTargetTypeIds
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim().toLowerCase()),
    });
  }

  return { version: obj.version, relationshipRules };
}

export function serializeSchemaFile(file: SchemaFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
