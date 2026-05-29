import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Connection, Node, Properties } from "../graph";
import { connectionId } from "../graph";
import {
  type ConnectionEntry,
  type ConnectionsFile,
  CONNECTIONS_FILE_VERSION,
  entryFromConnection,
  parseConnectionsFile,
  serializeConnectionsFile,
} from "./connections-file";
import {
  type DynamicFieldsFile,
  emptyDynamicFieldsFile,
  parseDynamicFieldsFile,
  serializeDynamicFieldsFile,
} from "./dynamic-fields-file";
import { bodyFromNode, nodeFromFile, serializeNodeFile } from "./node-file";
import {
  connectionsFilePath,
  dynamicFieldsFilePath,
  isNodeId,
  nodeFilePath,
  NODE_FILE_PATTERN,
} from "./paths";

function atomicWrite(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);
}

export class ContentStore {
  readonly contentDir: string;

  constructor(contentDir: string) {
    this.contentDir = contentDir;
    mkdirSync(contentDir, { recursive: true });
  }

  listNodeIds(): string[] {
    try {
      return readdirSync(this.contentDir)
        .filter((name) => NODE_FILE_PATTERN.test(name))
        .map((name) => name.slice(0, 32));
    } catch {
      return [];
    }
  }

  readNode(id: string): Node | null {
    if (!isNodeId(id)) return null;
    const path = nodeFilePath(this.contentDir, id);
    try {
      const raw = readFileSync(path, "utf-8");
      return nodeFromFile(id, raw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  writeNode(node: Node, body?: string): void {
    const markdownBody = body ?? bodyFromNode(node);
    const { body: _removed, ...rest } = node.properties;
    const toWrite: Node = { ...node, properties: rest };
    atomicWrite(nodeFilePath(this.contentDir, node.id), serializeNodeFile(toWrite, markdownBody));
  }

  deleteNodeFile(id: string): void {
    try {
      rmSync(nodeFilePath(this.contentDir, id), { force: true });
    } catch {
      /* ignore */
    }
  }

  readConnectionsFile(): ConnectionsFile {
    const path = connectionsFilePath(this.contentDir);
    try {
      return parseConnectionsFile(readFileSync(path, "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: CONNECTIONS_FILE_VERSION, connections: [] };
      }
      throw err;
    }
  }

  writeConnectionsFile(file: ConnectionsFile): void {
    atomicWrite(connectionsFilePath(this.contentDir), serializeConnectionsFile(file));
  }

  readConnections(): Connection[] {
    return this.readConnectionsFile().connections.map((entry) => {
      const properties = entry.properties ?? {};
      return {
        id: connectionId(entry.source, entry.label, entry.target),
        sourceNodeId: entry.source,
        targetNodeId: entry.target,
        label: entry.label,
        properties,
      };
    });
  }

  writeConnections(connections: Connection[]): void {
    const entries = connections.map(entryFromConnection);
    this.writeConnectionsFile({ version: CONNECTIONS_FILE_VERSION, connections: entries });
  }

  findConnection(source: string, target: string, label: string): Connection | null {
    return (
      this.readConnections().find(
        (c) => c.sourceNodeId === source && c.targetNodeId === target && c.label === label,
      ) ?? null
    );
  }

  upsertConnection(
    source: string,
    target: string,
    label: string,
    properties: Properties = {},
  ): void {
    const file = this.readConnectionsFile();
    const index = file.connections.findIndex(
      (c) => c.source === source && c.target === target && c.label === label,
    );
    const entry: ConnectionEntry = { source, target, label, properties };
    if (index >= 0) {
      const existing = file.connections[index]!;
      file.connections[index] = {
        ...entry,
        properties: { ...(existing.properties ?? {}), ...properties },
      };
    } else {
      file.connections.push(entry);
    }
    this.writeConnectionsFile(file);
  }

  mergeConnectionProperties(
    source: string,
    target: string,
    label: string,
    patch: Properties,
  ): void {
    const existing = this.findConnection(source, target, label);
    if (!existing) {
      this.upsertConnection(source, target, label, patch);
      return;
    }
    const merged = { ...existing.properties };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      merged[k] = v;
    }
    this.upsertConnection(source, target, label, merged);
  }

  deleteConnection(source: string, target: string, label: string): boolean {
    const file = this.readConnectionsFile();
    const before = file.connections.length;
    file.connections = file.connections.filter(
      (c) => !(c.source === source && c.target === target && c.label === label),
    );
    if (file.connections.length === before) return false;
    this.writeConnectionsFile(file);
    return true;
  }

  removeIncidentConnections(nodeId: string): void {
    const file = this.readConnectionsFile();
    file.connections = file.connections.filter(
      (c) => c.source !== nodeId && c.target !== nodeId,
    );
    this.writeConnectionsFile(file);
  }

  readDynamicFieldsFile(): DynamicFieldsFile {
    const path = dynamicFieldsFilePath(this.contentDir);
    try {
      return parseDynamicFieldsFile(readFileSync(path, "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyDynamicFieldsFile();
      }
      throw err;
    }
  }

  writeDynamicFieldsFile(file: DynamicFieldsFile): void {
    atomicWrite(dynamicFieldsFilePath(this.contentDir), serializeDynamicFieldsFile(file));
  }

  mergeNodeProperties(id: string, patch: Properties): boolean {
    const node = this.readNode(id);
    if (!node) return false;
    const merged = { ...node.properties, ...patch };
    const body = bodyFromNode(node);
    delete merged.body;
    this.writeNode({ id, labels: node.labels, properties: merged }, body);
    return true;
  }
}
