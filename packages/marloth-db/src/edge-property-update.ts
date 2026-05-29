import type { GraphDatabase, Properties } from "./graph";
import {
  PRIORITY_DEFAULT,
  isPriorityColumnKey,
  isPriorityValue,
  isUnsetPriority,
} from "./property-enums";
import { TYPE_MEMBERSHIP_LABELS } from "./labels";

export type EdgePropertyUpdateError = "not_found" | "invalid_value";

export function updateOutgoingEdgeProperty(
  db: GraphDatabase,
  sourceId: string,
  targetId: string,
  label: string,
  propertyKey: string,
  value: string | null,
): EdgePropertyUpdateError | null {
  const edge = db
    .listEdgesFromSource(sourceId, label)
    .find((e) => e.targetId === targetId);
  if (!edge) return "not_found";

  if (isPriorityColumnKey(propertyKey)) {
    const resolved: string = isUnsetPriority(value) ? PRIORITY_DEFAULT : (value ?? PRIORITY_DEFAULT);
    if (!isPriorityValue(resolved)) return "invalid_value";
    db.mergeEdgeProperties(edge.id, { ...edge.properties, [propertyKey]: resolved });
    return null;
  }

  const patch: Properties = { ...edge.properties };
  if (value === null || value === "") {
    delete patch[propertyKey];
  } else {
    patch[propertyKey] = value;
  }

  db.mergeEdgeProperties(edge.id, patch);
  return null;
}

export function updateDatabaseRowProperty(
  db: GraphDatabase,
  databaseId: string,
  pageId: string,
  propertyKey: string,
  value: string | null,
): EdgePropertyUpdateError | null {
  for (const label of TYPE_MEMBERSHIP_LABELS) {
    const edge = db.listEdgesFromSource(pageId, label).find((e) => e.targetId === databaseId);
    if (edge) {
      return updateOutgoingEdgeProperty(db, pageId, databaseId, label, propertyKey, value);
    }
  }
  return "not_found";
}
