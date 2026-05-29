import type { GraphDatabase, Properties } from "./graph";
import {
  PRIORITY_DEFAULT,
  isPriorityColumnKey,
  isPriorityValue,
  isUnsetPriority,
} from "./property-enums";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";

export type ConnectionPropertyUpdateError = "not_found" | "invalid_value";

export function updateOutgoingConnectionProperty(
  db: GraphDatabase,
  sourceNodeId: string,
  targetNodeId: string,
  label: string,
  propertyKey: string,
  value: string | null,
): ConnectionPropertyUpdateError | null {
  const connection = db
    .listConnectionsFromSource(sourceNodeId, label)
    .find((c) => c.targetNodeId === targetNodeId);
  if (!connection) return "not_found";

  if (isPriorityColumnKey(propertyKey)) {
    const resolved: string = isUnsetPriority(value) ? PRIORITY_DEFAULT : (value ?? PRIORITY_DEFAULT);
    if (!isPriorityValue(resolved)) return "invalid_value";
    db.mergeConnectionProperties(connection.id, { ...connection.properties, [propertyKey]: resolved });
    return null;
  }

  const patch: Properties = { ...connection.properties };
  if (value === null || value === "") {
    delete patch[propertyKey];
  } else {
    patch[propertyKey] = value;
  }

  db.mergeConnectionProperties(connection.id, patch);
  return null;
}

export function updateDatabaseRowProperty(
  db: GraphDatabase,
  databaseId: string,
  nodeId: string,
  propertyKey: string,
  value: string | null,
): ConnectionPropertyUpdateError | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const connection = db
      .listConnectionsFromSource(nodeId, label)
      .find((c) => c.targetNodeId === databaseId);
    if (connection) {
      return updateOutgoingConnectionProperty(db, nodeId, databaseId, label, propertyKey, value);
    }
  }
  return "not_found";
}
