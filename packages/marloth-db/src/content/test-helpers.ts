import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Node, Properties } from "../graph";
import { bodyFromNode, serializeNodeFile } from "./node-file";
import { fileFromSeedInputs } from "./dynamic-fields-file";
import type { SeedDynamicColumnSetInput, SeedDynamicFieldInput } from "../dynamic-fields/overlay";
import { invalidateDynamicFieldsCache } from "./sync";
import { openMarlothWriteContext, type MarlothWriteContext } from "./write-context";
import { writeFileSync } from "node:fs";
import { nodeFilePath } from "./paths";

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

export function seedTestRelationships(
  fixture: TestContentFixture,
  connections: Array<{
    source: string;
    target: string;
    label: string;
    properties?: Properties;
  }>,
  options?: { replace?: boolean },
): void {
  const file = options?.replace
    ? { version: 1 as const, relationships: [] }
    : fixture.ctx.store.readRelationshipsFile();
  for (const connection of connections) {
    const index = file.relationships.findIndex(
      (c) =>
        c.source === connection.source &&
        c.target === connection.target &&
        c.label === connection.label,
    );
    if (index >= 0) {
      file.relationships[index] = connection;
    } else {
      file.relationships.push(connection);
    }
  }
  fixture.ctx.store.writeRelationshipsFile(file);
  fixture.ctx.sync.syncRelationships();
}
