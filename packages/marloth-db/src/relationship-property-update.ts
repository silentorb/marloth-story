import type { Properties } from "./graph";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterRelationshipsWrite } from "./content/write-context";
import {
  PRIORITY_DEFAULT,
  isPriorityColumnKey,
  isPriorityValue,
  isUnsetPriority,
} from "./property-enums";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";

export type RelationshipPropertyUpdateError = "not_found" | "invalid_value";

export function updateOutgoingRelationshipProperty(
  ctx: MarlothWriteContext,
  sourceNodeId: string,
  targetNodeId: string,
  label: string,
  propertyKey: string,
  value: string | null,
): RelationshipPropertyUpdateError | null {
  const connection = ctx.store.findRelationship(sourceNodeId, targetNodeId, label);
  if (!connection) return "not_found";

  if (isPriorityColumnKey(propertyKey)) {
    const resolved: string = isUnsetPriority(value) ? PRIORITY_DEFAULT : (value ?? PRIORITY_DEFAULT);
    if (!isPriorityValue(resolved)) return "invalid_value";
    ctx.store.mergeRelationshipProperties(sourceNodeId, targetNodeId, label, {
      ...connection.properties,
      [propertyKey]: resolved,
    });
    syncAfterRelationshipsWrite(ctx);
    return null;
  }

  const patch: Properties = { ...connection.properties };
  if (value === null || value === "") {
    delete patch[propertyKey];
  } else {
    patch[propertyKey] = value;
  }

  ctx.store.mergeRelationshipProperties(sourceNodeId, targetNodeId, label, patch);
  syncAfterRelationshipsWrite(ctx);
  return null;
}

export function updateDatabaseRowProperty(
  ctx: MarlothWriteContext,
  databaseId: string,
  nodeId: string,
  propertyKey: string,
  value: string | null,
): RelationshipPropertyUpdateError | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const connection = ctx.store.findRelationship(nodeId, databaseId, label);
    if (connection) {
      return updateOutgoingRelationshipProperty(
        ctx,
        nodeId,
        databaseId,
        label,
        propertyKey,
        value,
      );
    }
  }
  return "not_found";
}
