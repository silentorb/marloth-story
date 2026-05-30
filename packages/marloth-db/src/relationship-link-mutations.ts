import type { Properties } from "./graph";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterRelationshipsWrite } from "./content/write-context";
import { nodeMatchesTargetTypes } from "./node-capabilities";
import { relationshipRuleContextForLabel } from "./schema-rules/resolve";
import type { SchemaFile } from "./schema-rules/schema-file";

export type LinkOutgoingRelationshipError =
  | "source_not_found"
  | "target_not_found"
  | "duplicate"
  | "target_type_not_allowed";

export type UnlinkOutgoingRelationshipError = "not_found";

function ordinalFromProperties(properties: Record<string, unknown>): number | null {
  const raw = properties.ordinal;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nextOutgoingOrdinal(
  ctx: MarlothWriteContext,
  sourceId: string,
  label: string,
): number | undefined {
  const outgoing = ctx.db.listRelationshipsFromSource(sourceId).filter((c) => c.label === label);
  if (outgoing.length === 0) return undefined;
  const ordinals = outgoing
    .map((c) => ordinalFromProperties(c.properties))
    .filter((v): v is number => v !== null);
  if (ordinals.length === 0) return undefined;
  return Math.max(...ordinals) + 1;
}

export interface LinkOutgoingRelationshipInput {
  sourceId: string;
  targetId: string;
  label: string;
  viaDatabase?: string;
  properties?: Properties;
  schema?: SchemaFile | null;
}

export function linkOutgoingRelationship(
  ctx: MarlothWriteContext,
  input: LinkOutgoingRelationshipInput,
): LinkOutgoingRelationshipError | null {
  const { sourceId, targetId, label, viaDatabase, properties = {}, schema } = input;
  const normalizedLabel = label.trim().toUpperCase();

  if (!ctx.store.readNode(sourceId)) return "source_not_found";
  if (!ctx.store.readNode(targetId)) return "target_not_found";

  if (ctx.store.findRelationship(sourceId, targetId, normalizedLabel)) {
    return "duplicate";
  }

  if (schema) {
    const ruleContext = relationshipRuleContextForLabel(schema, ctx.db, sourceId, normalizedLabel);
    if (
      ruleContext &&
      ruleContext.allowedTargetTypeIds.length > 0 &&
      !nodeMatchesTargetTypes(ctx.db, targetId, ruleContext.allowedTargetTypeIds)
    ) {
      return "target_type_not_allowed";
    }
  }

  const relProps: Properties = { ...properties };
  const nextOrdinal = nextOutgoingOrdinal(ctx, sourceId, normalizedLabel);
  if (nextOrdinal !== undefined) relProps.ordinal = nextOrdinal;
  if (viaDatabase) relProps.via_database = viaDatabase;

  ctx.store.upsertRelationship(sourceId, targetId, normalizedLabel, relProps);
  syncAfterRelationshipsWrite(ctx);
  return null;
}

export function unlinkOutgoingRelationship(
  ctx: MarlothWriteContext,
  sourceId: string,
  targetId: string,
  label: string,
): UnlinkOutgoingRelationshipError | null {
  const normalizedLabel = label.trim().toUpperCase();
  if (!ctx.store.findRelationship(sourceId, targetId, normalizedLabel)) {
    return "not_found";
  }
  ctx.store.deleteRelationship(sourceId, targetId, normalizedLabel);
  syncAfterRelationshipsWrite(ctx);
  return null;
}
