import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

export const RELATIONSHIPS_FILENAME = "relationships.json";
/** @deprecated Use RELATIONSHIPS_FILENAME. Legacy content file name (pre–relationship terminology). */
export const CONNECTIONS_FILENAME = "connections.json";
export const DYNAMIC_FIELDS_FILENAME = "dynamic-fields.json";
export const SCHEMA_FILENAME = "schema.json";
export const NODE_ID_PATTERN = /^[0-9a-f]{32}$/;
export const NODE_FILE_PATTERN = /^[0-9a-f]{32}\.md$/;

export function isNodeId(id: string): boolean {
  return NODE_ID_PATTERN.test(id);
}

export function nodeFileName(id: string): string {
  if (!isNodeId(id)) throw new Error(`Invalid node id: ${id}`);
  return `${id}.md`;
}

export function nodeFilePath(contentDir: string, id: string): string {
  return resolve(contentDir, nodeFileName(id));
}

export function relationshipsFilePath(contentDir: string): string {
  return resolve(contentDir, RELATIONSHIPS_FILENAME);
}

/** @deprecated Use relationshipsFilePath. */
export function connectionsFilePath(contentDir: string): string {
  return relationshipsFilePath(contentDir);
}

export function dynamicFieldsFilePath(contentDir: string): string {
  return resolve(contentDir, DYNAMIC_FIELDS_FILENAME);
}

export function schemaFilePath(contentDir: string): string {
  return resolve(contentDir, SCHEMA_FILENAME);
}

export function resolveContentPath(cwd = process.cwd()): string {
  if (process.env.MARLOTH_CONTENT_PATH) {
    return resolve(process.env.MARLOTH_CONTENT_PATH);
  }

  let dir = cwd;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, "content");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  return resolve(cwd, "content");
}

export function defaultDbPathForContent(contentDir: string): string {
  return resolve(contentDir, "..", "data", "marloth.sqlite");
}
