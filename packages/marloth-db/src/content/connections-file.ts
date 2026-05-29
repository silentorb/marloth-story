import type { Connection, Properties } from "../graph";
import { connectionId } from "../graph";

export const CONNECTIONS_FILE_VERSION = 1;

export interface ConnectionEntry {
  source: string;
  target: string;
  label: string;
  properties?: Properties;
}

export interface ConnectionsFile {
  version: number;
  connections: ConnectionEntry[];
}

export function parseConnectionsFile(raw: string): ConnectionsFile {
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("connections.json: root must be an object");
  }
  const obj = data as Record<string, unknown>;
  const version = obj.version;
  const connections = obj.connections;
  if (typeof version !== "number") {
    throw new Error("connections.json: version is required");
  }
  if (!Array.isArray(connections)) {
    throw new Error("connections.json: connections must be an array");
  }

  const entries: ConnectionEntry[] = [];
  for (const item of connections) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("connections.json: each connection must be an object");
    }
    const row = item as Record<string, unknown>;
    const source = row.source;
    const target = row.target;
    const label = row.label;
    if (typeof source !== "string" || typeof target !== "string" || typeof label !== "string") {
      throw new Error("connections.json: source, target, and label are required strings");
    }
    const properties =
      row.properties && typeof row.properties === "object" && !Array.isArray(row.properties)
        ? (row.properties as Properties)
        : undefined;
    entries.push({ source, target, label, properties });
  }

  return { version, connections: entries };
}

export function serializeConnectionsFile(file: ConnectionsFile): string {
  const normalized: ConnectionsFile = {
    version: file.version,
    connections: file.connections.map((c) => ({
      source: c.source,
      target: c.target,
      label: c.label,
      ...(c.properties && Object.keys(c.properties).length > 0 ? { properties: c.properties } : {}),
    })),
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function connectionFromEntry(entry: ConnectionEntry): Connection {
  const properties = entry.properties ?? {};
  const id = connectionId(entry.source, entry.label, entry.target);
  return {
    id,
    sourceNodeId: entry.source,
    targetNodeId: entry.target,
    label: entry.label,
    properties,
  };
}

export function entryFromConnection(connection: Connection): ConnectionEntry {
  return {
    source: connection.sourceNodeId,
    target: connection.targetNodeId,
    label: connection.label,
    ...(Object.keys(connection.properties).length > 0
      ? { properties: connection.properties }
      : {}),
  };
}
