/** (instance)-[:IS_A {…}]->(type) — a page is an instance of a type (imported from Notion database rows). */
export const IS_A_LABEL = "IS_A";

/** Legacy Notion-import label; still read for older edges in the graph. */
export const LEGACY_IN_DATABASE_LABEL = "IN_DATABASE";

export const TYPE_MEMBERSHIP_LABELS = [IS_A_LABEL, LEGACY_IN_DATABASE_LABEL] as const;

export function isTypeMembershipLabel(label: string): boolean {
  return (TYPE_MEMBERSHIP_LABELS as readonly string[]).includes(label);
}
