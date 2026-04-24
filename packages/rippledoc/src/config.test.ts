import { describe, expect, test } from "bun:test";
import { readConfig } from "./config";

describe("readConfig", () => {
  test("CLI overrides env for watch mode", () => {
    const r = readConfig(
      ["--watch-mode", "polling", "--repo-root", "/tmp/x"],
      {
        MARLOTH_WATCH_MODE: "native",
        MARLOTH_REPO_ROOT: "/ignored",
      } as NodeJS.ProcessEnv,
    );
    expect(r.help).toBe(false);
    if (r.help) return;
    expect(r.config.watchMode).toBe("polling");
    expect(r.config.repoRoot).toBe("/tmp/x");
  });

  test("env defaults and aliases", () => {
    const r = readConfig(
      [],
      { WATCH_MODE: "audit" } as NodeJS.ProcessEnv,
    );
    expect(r.help).toBe(false);
    if (r.help) return;
    expect(r.config.watchMode).toBe("audit");
  });

  test("RIPPLEDOC_ env wins over MARLOTH_ for watch mode", () => {
    const r = readConfig(
      [],
      {
        RIPPLEDOC_WATCH_MODE: "native",
        MARLOTH_WATCH_MODE: "polling",
      } as NodeJS.ProcessEnv,
    );
    expect(r.help).toBe(false);
    if (r.help) return;
    expect(r.config.watchMode).toBe("native");
  });

  test("--help", () => {
    const r = readConfig(["--help"], {});
    expect(r.help).toBe(true);
  });
});
