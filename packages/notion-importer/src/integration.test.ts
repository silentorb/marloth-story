import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { GraphDatabase } from "marloth-db";
import { run } from "./pipeline";

const tempRepo = mkdtempSync(join(tmpdir(), "notion-importer-test-"));
const exportDir = join(tempRepo, "exports", "test-export");
const TEST_MD_NAME = "Test Page 0123456789abcdef0123456789abcdef.md";
const TEST_REL_MD = "Related 0123456789abcdef0123456789abcdee.md";

describe("integration", () => {
  afterAll(() => {
    try {
      rmSync(tempRepo, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("pipeline imports export into sqlite graph", async () => {
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(
      join(exportDir, TEST_MD_NAME),
      "# Test Page\n\nLinks: Other (Related%200123456789abcdef0123456789abcdee.md)\n",
      { encoding: "utf-8" },
    );
    writeFileSync(
      join(exportDir, TEST_REL_MD),
      "# Related\n\nBody text.\n",
      { encoding: "utf-8" },
    );

    const dbPath = join(tempRepo, "data", "test.sqlite");
    await run({ repoRoot: tempRepo, clean: true, source: exportDir, dbPath });

    expect(statSync(dbPath).isFile()).toBe(true);

    const db = new GraphDatabase(dbPath);
    const page = db.getVertex("0123456789abcdef0123456789abcdef");
    expect(page?.properties.title).toBe("Test Page");
    const rel = db.getVertex("0123456789abcdef0123456789abcdee");
    expect(rel?.properties.body).toContain("Body text");
    const edge = db.getEdge(
      "0123456789abcdef0123456789abcdef:LINKS:0123456789abcdef0123456789abcdee",
    );
    expect(edge?.label).toBe("LINKS");
    db.close();
  });
});
