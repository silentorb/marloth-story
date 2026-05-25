import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { run } from "./pipeline";

const tempRepo = mkdtempSync(join(tmpdir(), "notion-importer-test-"));
const exportDir = join(tempRepo, "exports", "test-export");
const TEST_MD_NAME = "Test Page 0123456789abcdef0123456789abcdef.md";

describe("integration", () => {
  afterAll(() => {
    try {
      rmSync(tempRepo, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  test("pipeline produces content from exports", async () => {
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(
      join(exportDir, TEST_MD_NAME),
      "# Test Page\n\nThis is a test export.\n",
      { encoding: "utf-8" },
    );
    await run({ repoRoot: tempRepo, clean: true, source: exportDir });
    const outFiles = readdirSync(join(tempRepo, "content")).filter((f) =>
      f.endsWith(".md"),
    );
    expect(outFiles.length).toBe(1);
    expect(outFiles[0]).toBe("test-page-0123456789abcdef0123456789abcdef.md");
  });
});
