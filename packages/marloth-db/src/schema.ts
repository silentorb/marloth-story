export const SCHEMA_VERSION = 3;

export const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS node_labels (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (node_id, label)
);

CREATE INDEX IF NOT EXISTS idx_node_labels_label ON node_labels(label);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY NOT NULL,
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_node_id);
CREATE INDEX IF NOT EXISTS idx_connections_label ON connections(label);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_endpoint_label ON connections(source_node_id, target_node_id, label);
`;

/** Overlay tables for dynamic table field configuration (separate from core graph). */
export const DYNAMIC_FIELDS_DDL = `
CREATE TABLE IF NOT EXISTS dynamic_fields (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL,
  column_key TEXT NOT NULL,
  column_name TEXT NOT NULL,
  column_type TEXT NOT NULL DEFAULT 'number',
  resolver_id TEXT NOT NULL,
  docs_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(database_id, column_key)
);

CREATE TABLE IF NOT EXISTS dynamic_field_params (
  field_id TEXT NOT NULL REFERENCES dynamic_fields(id) ON DELETE CASCADE,
  param_key TEXT NOT NULL,
  param_value TEXT NOT NULL,
  PRIMARY KEY (field_id, param_key)
);

CREATE TABLE IF NOT EXISTS dynamic_field_view_bindings (
  field_id TEXT NOT NULL REFERENCES dynamic_fields(id) ON DELETE CASCADE,
  view_name TEXT NOT NULL,
  PRIMARY KEY (field_id, view_name)
);

CREATE TABLE IF NOT EXISTS dynamic_column_sets (
  id TEXT PRIMARY KEY NOT NULL,
  database_id TEXT NOT NULL,
  column_key_pattern TEXT NOT NULL,
  column_name_pattern TEXT NOT NULL,
  column_type TEXT NOT NULL DEFAULT 'number',
  resolver_id TEXT NOT NULL,
  docs_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dynamic_column_set_params (
  set_id TEXT NOT NULL REFERENCES dynamic_column_sets(id) ON DELETE CASCADE,
  param_key TEXT NOT NULL,
  param_value TEXT NOT NULL,
  PRIMARY KEY (set_id, param_key)
);

CREATE TABLE IF NOT EXISTS dynamic_column_set_view_bindings (
  set_id TEXT NOT NULL REFERENCES dynamic_column_sets(id) ON DELETE CASCADE,
  view_name TEXT NOT NULL,
  PRIMARY KEY (set_id, view_name)
);
`;
