import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Node, Properties } from "../graph";
import { bodyFromNode, serializeNodeFile } from "./node-file";
import { fileFromSeedInputs } from "./dynamic-fields-file";
import { serializeViewsFile, type ViewsFile } from "./views-file";
import {
  serializeTableSchemasFile,
  type TableColumnDef,
  type TableSchemasFile,
} from "./table-schemas-file";
import { invalidateTableSchemasCache } from "../table-schemas/load";
import type { SeedDynamicColumnSetInput, SeedDynamicFieldInput } from "../dynamic-fields/overlay";
import { invalidateDynamicFieldsCache } from "./sync";
import { invalidateViewsCache } from "../views/load";
import { openMarlothWriteContext, type MarlothWriteContext } from "./write-context";
import { writeFileSync } from "node:fs";
import { nodeFilePath } from "./paths";
import {
  entryFromRelationship,
  RELATIONSHIPS_FILE_VERSION,
  type RelationshipEntry,
  sortEndpoints,
} from "./relationships-file";
import { relationshipId } from "../graph";
import {
  registerBidirectionalType,
  registerIncludesType,
  registerUnidirectionalType,
} from "./relationship-types-file";
import { INCLUDES_TYPE } from "../includes-relationship";

export interface TestContentFixture {
  tempDir: string;
  ctx: MarlothWriteContext;
}

export function createTestContentFixture(prefix = "marloth-content-test-"): TestContentFixture {
  const tempDir = mkdtempSync(join(tmpdir(), prefix));
  const contentDir = join(tempDir, "content");
  mkdirSync(contentDir, { recursive: true });
  const dbPath = join(tempDir, "test.sqlite");
  const ctx = openMarlothWriteContext(contentDir, dbPath);
  ctx.store.writeDynamicFieldsFile(fileFromSeedInputs([], []));
  invalidateDynamicFieldsCache();
  return { tempDir, ctx };
}

export function destroyTestContentFixture(fixture: TestContentFixture): void {
  fixture.ctx.db.close();
  try {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function seedTestNode(fixture: TestContentFixture, node: Node, body?: string): void {
  const markdownBody = body ?? bodyFromNode(node);
  const { body: _b, ...properties } = node.properties;
  writeFileSync(
    nodeFilePath(fixture.ctx.store.contentDir, node.id),
    serializeNodeFile({ id: node.id, properties }, markdownBody),
    "utf-8",
  );
  fixture.ctx.sync.syncNode(node.id);
}

export function seedTestDynamicFields(
  fixture: TestContentFixture,
  fields: SeedDynamicFieldInput[],
  columnSets: SeedDynamicColumnSetInput[] = [],
): void {
  fixture.ctx.store.writeDynamicFieldsFile(fileFromSeedInputs(fields, columnSets));
  invalidateDynamicFieldsCache();
}

export function seedTestViews(fixture: TestContentFixture, file: ViewsFile): void {
  fixture.ctx.store.writeViewsFile(file);
  invalidateViewsCache();
}

export function seedTestTableSchemas(fixture: TestContentFixture, file: TableSchemasFile): void {
  fixture.ctx.store.writeTableSchemasFile(file);
  invalidateTableSchemasCache();
}

export function seedTestTableSchema(
  fixture: TestContentFixture,
  databaseId: string,
  columns: TableColumnDef[],
): void {
  const file = fixture.ctx.store.readTableSchemasFile();
  file.tables[databaseId] = { columns };
  fixture.ctx.store.writeTableSchemasFile(file);
  invalidateTableSchemasCache();
}

function entryFromSeedConnection(connection: {
  source: string;
  target: string;
  type: string;
  properties?: Properties;
}): RelationshipEntry {
  return entryFromRelationship({
    id: relationshipId(connection.source, connection.type, connection.target),
    sourceNodeId: connection.source,
    targetNodeId: connection.target,
    type: connection.type,
    properties: connection.properties ?? {},
  });
}

export function seedTestIncludes(
  fixture: TestContentFixture,
  connections: Array<{
    a: string;
    b: string;
    properties?: Properties;
  }>,
  options?: { replace?: boolean },
): void {
  const registry = options?.replace
    ? { version: 1 as const, types: {} as Record<string, never> }
    : fixture.ctx.store.readRelationshipTypesFile();
  const file = options?.replace
    ? { version: RELATIONSHIPS_FILE_VERSION, relationships: [] as RelationshipEntry[] }
    : fixture.ctx.store.readRelationshipsFile();

  registerIncludesType(registry);

  for (const connection of connections) {
    const { a, b } = sortEndpoints(connection.a, connection.b);
    const entry: RelationshipEntry = {
      a,
      b,
      type: INCLUDES_TYPE,
      properties: connection.properties ?? {},
    };
    const index = file.relationships.findIndex(
      (existing) =>
        existing.a === entry.a && existing.b === entry.b && existing.type === entry.type,
    );
    if (index >= 0) {
      file.relationships[index] = entry;
    } else {
      file.relationships.push(entry);
    }
  }

  fixture.ctx.store.writeRelationshipTypesFile(registry);
  fixture.ctx.store.writeRelationshipsFile(file);
  fixture.ctx.sync.syncRelationships();
}

export function seedTestCompositeRelationships(
  fixture: TestContentFixture,
  connections: Array<{
    a: string;
    b: string;
    typeFromA: string;
    typeFromB: string;
    properties?: Properties;
    directedFrom?: string;
  }>,
  options?: { replace?: boolean },
): void {
  const registry = options?.replace
    ? { version: 1 as const, types: {} as Record<string, never> }
    : fixture.ctx.store.readRelationshipTypesFile();
  const file = options?.replace
    ? { version: RELATIONSHIPS_FILE_VERSION, relationships: [] as RelationshipEntry[] }
    : fixture.ctx.store.readRelationshipsFile();

  for (const connection of connections) {
    const compositeType = registerBidirectionalType(
      registry,
      connection.typeFromA,
      connection.typeFromB,
    );
    const { a, b } = sortEndpoints(connection.a, connection.b);
    const entry: RelationshipEntry = {
      a,
      b,
      type: compositeType,
      properties: connection.properties ?? {},
      directedFrom: connection.directedFrom,
    };
    const index = file.relationships.findIndex(
      (existing) =>
        existing.a === entry.a && existing.b === entry.b && existing.type === entry.type,
    );
    if (index >= 0) {
      file.relationships[index] = entry;
    } else {
      file.relationships.push(entry);
    }
  }

  fixture.ctx.store.writeRelationshipTypesFile(registry);
  fixture.ctx.store.writeRelationshipsFile(file);
  fixture.ctx.sync.syncRelationships();
}

export function seedTestRelationships(
  fixture: TestContentFixture,
  connections: Array<{
    source: string;
    target: string;
    type: string;
    properties?: Properties;
  }>,
  options?: { replace?: boolean },
): void {
  const registry = options?.replace
    ? { version: 1 as const, types: {} as Record<string, never> }
    : fixture.ctx.store.readRelationshipTypesFile();
  const file = options?.replace
    ? { version: RELATIONSHIPS_FILE_VERSION, relationships: [] as RelationshipEntry[] }
    : fixture.ctx.store.readRelationshipsFile();

  for (const connection of connections) {
    registerUnidirectionalType(registry, connection.type);
    const entry = entryFromSeedConnection(connection);
    const index = file.relationships.findIndex(
      (existing) =>
        existing.a === entry.a &&
        existing.b === entry.b &&
        existing.type === entry.type,
    );
    if (index >= 0) {
      file.relationships[index] = entry;
    } else {
      file.relationships.push(entry);
    }
  }

  fixture.ctx.store.writeRelationshipTypesFile(registry);
  fixture.ctx.store.writeRelationshipsFile(file);
  fixture.ctx.sync.syncRelationships();
}

export { registerBidirectionalType, registerUnidirectionalType, sortEndpoints };
