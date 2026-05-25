import { build, context } from "esbuild";
import { resolve } from "node:path";

const entry = resolve(import.meta.dir, "../src/extension/extension.ts");
const outfile = resolve(import.meta.dir, "../dist/extension.js");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: [entry],
  bundle: true,
  outfile,
  platform: "node" as const,
  format: "cjs" as const,
  external: ["vscode"],
  sourcemap: true,
  target: "node18",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching extension host bundle…");
} else {
  await build(options);
  console.log(`Built ${outfile}`);
}
