import { join } from "node:path";
import { createApiHandler } from "./server";
import type { TestContentFixture } from "marloth-db/content/test-helpers";

export function createTestApiFromContent(fixture: TestContentFixture) {
  fixture.ctx.sync.fullRebuild();
  const dbPath = join(fixture.tempDir, "api.sqlite");
  const handler = createApiHandler(dbPath, undefined, fixture.ctx.store.contentDir);
  return { handler, dbPath };
}
