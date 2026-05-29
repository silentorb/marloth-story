export const SCHEMA_VERSION = 6;

export const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY NOT NULL,
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_node_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_node_id);
CREATE INDEX IF NOT EXISTS idx_relationships_label ON relationships(label);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_endpoint_label ON relationships(source_node_id, target_node_id, label);
`;

/** @deprecated Dynamic field configuration lives in content/dynamic-fields.json (schema v4+). */
export const DYNAMIC_FIELDS_DDL = "";
