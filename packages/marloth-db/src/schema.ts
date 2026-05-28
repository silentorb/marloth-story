export const SCHEMA_VERSION = 2;

export const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vertices (
  id TEXT PRIMARY KEY NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS vertex_labels (
  vertex_id TEXT NOT NULL REFERENCES vertices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (vertex_id, label)
);

CREATE INDEX IF NOT EXISTS idx_vertex_labels_label ON vertex_labels(label);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT NOT NULL REFERENCES vertices(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES vertices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_label ON edges(label);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_endpoint_label ON edges(source_id, target_id, label);
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
