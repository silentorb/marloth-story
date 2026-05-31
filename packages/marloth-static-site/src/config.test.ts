import { describe, expect, test } from "bun:test";
import { applyBuildEnv, readConfig } from "./config";

describe("readConfig", () => {
  test("uses defaults from repo root", () => {
    const result = readConfig([], {});
    expect(result.help).toBe(false);
    if (result.help) return;
    expect(result.config.base).toBe("/");
    expect(result.config.outDir).toMatch(/dist\/web$/);
    expect(result.config.contentDir).toMatch(/content$/);
    expect(result.config.dbPath).toMatch(/marloth\.sqlite$/);
  });

  test("CLI overrides environment", () => {
    const result = readConfig(
      ["--out-dir=/tmp/out", "--base=/embed/"],
      { MARLOTH_WEB_OUT_DIR: "/env/out", MARLOTH_WEB_BASE: "/env/" },
    );
    expect(result.help).toBe(false);
    if (result.help) return;
    expect(result.config.outDir).toBe("/tmp/out");
    expect(result.config.base).toBe("/embed/");
  });

  test("environment fills omitted flags", () => {
    const result = readConfig([], {
      MARLOTH_WEB_OUT_DIR: "/env/out",
      MARLOTH_CONTENT_PATH: "/env/content",
      MARLOTH_WEB_BASE: "/docs/",
    });
    expect(result.help).toBe(false);
    if (result.help) return;
    expect(result.config.outDir).toBe("/env/out");
    expect(result.config.contentDir).toBe("/env/content");
    expect(result.config.base).toBe("/docs/");
  });

  test("applyBuildEnv sets process env for Astro", () => {
    const env: NodeJS.ProcessEnv = {};
    applyBuildEnv(
      {
        repoRoot: "/repo",
        contentDir: "/repo/content",
        dbPath: "/repo/data/marloth.sqlite",
        outDir: "/repo/dist/web",
        base: "/design/",
      },
      env,
    );
    expect(env.MARLOTH_CONTENT_PATH).toBe("/repo/content");
    expect(env.MARLOTH_DB_PATH).toBe("/repo/data/marloth.sqlite");
    expect(env.MARLOTH_WEB_OUT_DIR).toBe("/repo/dist/web");
    expect(env.MARLOTH_WEB_BASE).toBe("/design/");
  });
});
