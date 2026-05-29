import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Relationship, Node, Properties } from "../graph";
import { relationshipId } from "../graph";
import {
  type RelationshipEntry,
  type RelationshipsFile,
  RELATIONSHIPS_FILE_VERSION,
  entryFromRelationship,
  parseRelationshipsFile,
  serializeRelationshipsFile,
} from "./relationships-file";
import {
  type DynamicFieldsFile,
  emptyDynamicFieldsFile,
  parseDynamicFieldsFile,
  serializeDynamicFieldsFile,
} from "./dynamic-fields-file";
import { bodyFromNode, nodeFromFile, serializeNodeFile } from "./node-file";
import {
  relationshipsFilePath,
  dynamicFieldsFilePath,
  isNodeId,
  nodeFilePath,
  NODE_FILE_PATTERN,
  CONNECTIONS_FILENAME,
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

  readRelationshipsFile(): RelationshipsFile {
    const path = relationshipsFilePath(this.contentDir);
    try {
      return parseRelationshipsFile(readFileSync(path, "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        const legacyFile = join(this.contentDir, CONNECTIONS_FILENAME);
        try {
          return parseRelationshipsFile(readFileSync(legacyFile, "utf-8"));
        } catch (legacyErr) {
          if ((legacyErr as NodeJS.ErrnoException).code === "ENOENT") {
            return { version: RELATIONSHIPS_FILE_VERSION, relationships: [] };
          }
          throw legacyErr;
        }
      }
      throw err;
    }
  }

  writeRelationshipsFile(file: RelationshipsFile): void {
    atomicWrite(relationshipsFilePath(this.contentDir), serializeRelationshipsFile(file));
  }

  readRelationships(): Relationship[] {
    return this.readRelationshipsFile().relationships.map((entry) => {
      const properties = entry.properties ?? {};
      return {
        id: relationshipId(entry.source, entry.label, entry.target),
        sourceNodeId: entry.source,
        targetNodeId: entry.target,
        label: entry.label,
        properties,
      };
    });
  }

  writeRelationships(connections: Relationship[]): void {
    const entries = connections.map(entryFromRelationship);
    this.writeRelationshipsFile({ version: RELATIONSHIPS_FILE_VERSION, relationships: entries });
  }

  findRelationship(source: string, target: string, label: string): Relationship | null {
    return (
      this.readRelationships().find(
        (c) => c.sourceNodeId === source && c.targetNodeId === target && c.label === label,
      ) ?? null
    );
  }

  upsertRelationship(
    source: string,
    target: string,
    label: string,
    properties: Properties = {},
  ): void {
    const file = this.readRelationshipsFile();
    const index = file.relationships.findIndex(
      (c) => c.source === source && c.target === target && c.label === label,
    );
    const entry: RelationshipEntry = { source, target, label, properties };
    if (index >= 0) {
      const existing = file.relationships[index]!;
      file.relationships[index] = {
        ...entry,
        properties: { ...(existing.properties ?? {}), ...properties },
      };
    } else {
      file.relationships.push(entry);
    }
    this.writeRelationshipsFile(file);
  }

  mergeRelationshipProperties(
    source: string,
    target: string,
    label: string,
    patch: Properties,
  ): void {
    const existing = this.findRelationship(source, target, label);
    if (!existing) {
      this.upsertRelationship(source, target, label, patch);
      return;
    }
    const merged = { ...existing.properties };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      merged[k] = v;
    }
    this.upsertRelationship(source, target, label, merged);
  }

  deleteRelationship(source: string, target: string, label: string): boolean {
    const file = this.readRelationshipsFile();
    const before = file.relationships.length;
    file.relationships = file.relationships.filter(
      (c) => !(c.source === source && c.target === target && c.label === label),
    );
    if (file.relationships.length === before) return false;
    this.writeRelationshipsFile(file);
    return true;
  }

  removeIncidentRelationships(nodeId: string): void {
    const file = this.readRelationshipsFile();
    file.relationships = file.relationships.filter(
      (c) => c.source !== nodeId && c.target !== nodeId,
    );
    this.writeRelationshipsFile(file);
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
    this.writeNode({ id, properties: merged }, body);
    return true;
  }
}
