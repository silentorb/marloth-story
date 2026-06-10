import { describe, expect, test } from "bun:test";
import { readConfig } from "./config";

describe("readConfig", () => {
  test("CLI overrides env for source", () => {
    const r = readConfig(
      ["--source", "/tmp/export", "--clean"],
      { NOTION_EXPORT_DIR: "/ignored" } as NodeJS.ProcessEnv,
    );
    expect(r.help).toBe(false);
    if (r.help) return;
    expect(r.config.source).toBe("/tmp/export");
    expect(r.config.clean).toBe(true);
  });

  test("--help", () => {
    expect(readConfig(["--help"], {}).help).toBe(true);
  });
});
