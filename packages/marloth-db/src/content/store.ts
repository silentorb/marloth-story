import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Node, Properties } from "../graph";
import { relationshipId } from "../graph";
import { normalizeRelationshipType } from "../relation-type";
import {
  type RelationshipEntry,
  type RelationshipsFile,
  RELATIONSHIPS_FILE_VERSION,
  parseRelationshipsFile,
  relationshipRecordId,
  serializeRelationshipsFile,
  sortEndpoints,
} from "./relationships-file";
import {
  type RelationshipTypesFile,
  RELATIONSHIP_TYPES_FILE_VERSION,
  emptyRelationshipTypesFile,
  isBidirectionalComposite,
  localTypesForComposite,
  parseRelationshipTypesFile,
  registerBidirectionalType,
  registerUnidirectionalType,
  resolveCompositeType,
  serializeRelationshipTypesFile,
} from "./relationship-types-file";
import {
  type DynamicFieldsFile,
  emptyDynamicFieldsFile,
  parseDynamicFieldsFile,
  serializeDynamicFieldsFile,
} from "./dynamic-fields-file";
import {
  type ViewsFile,
  emptyViewsFile,
  parseViewsFile,
  serializeViewsFile,
} from "./views-file";
import { bodyFromNode, nodeFromFile, serializeNodeFile } from "./node-file";
import {
  relationshipsFilePath,
  relationshipTypesFilePath,
  dynamicFieldsFilePath,
  viewsFilePath,
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

  readRelationshipTypesFile(): RelationshipTypesFile {
    const path = relationshipTypesFilePath(this.contentDir);
    try {
      return parseRelationshipTypesFile(readFileSync(path, "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyRelationshipTypesFile();
      }
      throw err;
    }
  }

  writeRelationshipTypesFile(file: RelationshipTypesFile): void {
    atomicWrite(relationshipTypesFilePath(this.contentDir), serializeRelationshipTypesFile(file));
  }

  findContentEntry(
    source: string,
    target: string,
    localType: string,
  ): RelationshipEntry | null {
    const registry = this.readRelationshipTypesFile();
    const normalized = normalizeRelationshipType(localType);
    const { a, b } = sortEndpoints(source, target);

    for (const entry of this.readRelationshipsFile().relationships) {
      if (entry.a !== a || entry.b !== b) continue;
      const perspectives = localTypesForComposite(registry, entry.type);
      if (perspectives.includes(normalized)) {
        return entry;
      }
      if (!isBidirectionalComposite(registry, entry.type) && entry.type === normalized) {
        return entry;
      }
    }
    return null;
  }

  findRelationship(source: string, target: string, localType: string) {
    const entry = this.findContentEntry(source, target, localType);
    if (!entry) return null;
    const normalized = normalizeRelationshipType(localType);
    return {
      id: relationshipId(source, normalized, target),
      sourceNodeId: source,
      targetNodeId: target,
      type: normalized,
      properties: entry.properties ?? {},
    };
  }

  upsertRelationship(
    source: string,
    target: string,
    localType: string,
    properties: Properties = {},
  ): void {
    const registry = this.readRelationshipTypesFile();
    const file = this.readRelationshipsFile();
    const normalized = normalizeRelationshipType(localType);
    const { a, b } = sortEndpoints(source, target);

    let composite = resolveCompositeType(registry, normalized);
    const existing = file.relationships.find((e) => e.a === a && e.b === b && e.type === composite);

    if (!existing) {
      for (const entry of file.relationships) {
        if (entry.a !== a || entry.b !== b) continue;
        const perspectives = localTypesForComposite(registry, entry.type);
        if (perspectives.includes(normalized)) {
          composite = entry.type;
          break;
        }
      }
    }

    const index = file.relationships.findIndex((e) => e.a === a && e.b === b && e.type === composite);
    const entry: RelationshipEntry = {
      a,
      b,
      type: composite,
      directedFrom: source,
      properties,
    };

    if (index >= 0) {
      const prev = file.relationships[index]!;
      file.relationships[index] = {
        ...entry,
        directedFrom: prev.directedFrom ?? entry.directedFrom,
        properties: { ...(prev.properties ?? {}), ...properties },
      };
    } else {
      if (!registry.types[composite]) {
        registerUnidirectionalType(registry, composite);
        this.writeRelationshipTypesFile(registry);
      }
      file.relationships.push(entry);
    }
    this.writeRelationshipsFile(file);
  }

  mergeRelationshipProperties(
    source: string,
    target: string,
    localType: string,
    patch: Properties,
  ): void {
    const existing = this.findRelationship(source, target, localType);
    if (!existing) {
      this.upsertRelationship(source, target, localType, patch);
      return;
    }
    const merged = { ...existing.properties };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      merged[k] = v;
    }
    this.upsertRelationship(source, target, localType, merged);
  }

  deleteRelationship(source: string, target: string, localType: string): boolean {
    const registry = this.readRelationshipTypesFile();
    const file = this.readRelationshipsFile();
    const normalized = normalizeRelationshipType(localType);
    const { a, b } = sortEndpoints(source, target);
    const before = file.relationships.length;

    file.relationships = file.relationships.filter((entry) => {
      if (entry.a !== a || entry.b !== b) return true;
      const perspectives = localTypesForComposite(registry, entry.type);
      if (perspectives.includes(normalized)) return false;
      if (!isBidirectionalComposite(registry, entry.type) && entry.type === normalized) {
        return false;
      }
      return true;
    });

    if (file.relationships.length === before) return false;
    this.writeRelationshipsFile(file);
    return true;
  }

  removeIncidentRelationships(nodeId: string): void {
    const file = this.readRelationshipsFile();
    file.relationships = file.relationships.filter(
      (c) => c.a !== nodeId && c.b !== nodeId,
    );
    this.writeRelationshipsFile(file);
  }

  /** Register a bidirectional composite type and return its storage type name. */
  ensureBidirectionalType(typeFromSource: string, typeFromTarget: string): string {
    const registry = this.readRelationshipTypesFile();
    const composite = registerBidirectionalType(registry, typeFromSource, typeFromTarget);
    this.writeRelationshipTypesFile(registry);
    return composite;
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

  readViewsFile(): ViewsFile {
    const path = viewsFilePath(this.contentDir);
    try {
      return parseViewsFile(readFileSync(path, "utf-8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyViewsFile();
      }
      throw err;
    }
  }

  writeViewsFile(file: ViewsFile): void {
    atomicWrite(viewsFilePath(this.contentDir), serializeViewsFile(file));
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

export { relationshipRecordId, registerBidirectionalType, registerUnidirectionalType };
