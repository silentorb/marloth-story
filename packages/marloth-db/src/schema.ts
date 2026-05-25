export const SCHEMA_VERSION = 1;

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
