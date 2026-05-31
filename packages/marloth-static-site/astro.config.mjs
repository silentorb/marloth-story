import { defineConfig } from "astro/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../..");

/** @param {string | undefined} value */
function resolveOutDir(value) {
  if (value) return resolve(value);
  return resolve(repoRoot, "dist/web");
}

/** @param {string | undefined} value */
function normalizeBase(value) {
  if (!value || value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

export default defineConfig({
  srcDir: "src",
  outDir: resolveOutDir(process.env.MARLOTH_WEB_OUT_DIR),
  base: normalizeBase(process.env.MARLOTH_WEB_BASE),
  build: {
    format: "directory",
  },
});
