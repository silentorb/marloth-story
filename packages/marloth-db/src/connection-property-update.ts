import type { Properties } from "./graph";
import type { MarlothWriteContext } from "./content/write-context";
import { syncAfterConnectionsWrite } from "./content/write-context";
import {
  PRIORITY_DEFAULT,
  isPriorityColumnKey,
  isPriorityValue,
  isUnsetPriority,
} from "./property-enums";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";

export type ConnectionPropertyUpdateError = "not_found" | "invalid_value";

export function updateOutgoingConnectionProperty(
  ctx: MarlothWriteContext,
  sourceNodeId: string,
  targetNodeId: string,
  label: string,
  propertyKey: string,
  value: string | null,
): ConnectionPropertyUpdateError | null {
  const connection = ctx.store.findConnection(sourceNodeId, targetNodeId, label);
  if (!connection) return "not_found";

  if (isPriorityColumnKey(propertyKey)) {
    const resolved: string = isUnsetPriority(value) ? PRIORITY_DEFAULT : (value ?? PRIORITY_DEFAULT);
    if (!isPriorityValue(resolved)) return "invalid_value";
    ctx.store.mergeConnectionProperties(sourceNodeId, targetNodeId, label, {
      ...connection.properties,
      [propertyKey]: resolved,
    });
    syncAfterConnectionsWrite(ctx);
    return null;
  }

  const patch: Properties = { ...connection.properties };
  if (value === null || value === "") {
    delete patch[propertyKey];
  } else {
    patch[propertyKey] = value;
  }

  ctx.store.mergeConnectionProperties(sourceNodeId, targetNodeId, label, patch);
  syncAfterConnectionsWrite(ctx);
  return null;
}

export function updateDatabaseRowProperty(
  ctx: MarlothWriteContext,
  databaseId: string,
  nodeId: string,
  propertyKey: string,
  value: string | null,
): ConnectionPropertyUpdateError | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const connection = ctx.store.findConnection(nodeId, databaseId, label);
    if (connection) {
      return updateOutgoingConnectionProperty(
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
