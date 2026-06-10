import { printHelp, readConfig } from "./config";
import { run } from "./pipeline";

const result = readConfig(process.argv.slice(2));
if (result.help) {
  printHelp();
  process.exit(0);
}

const { config } = result;

await run({
  repoRoot: config.repoRoot,
  clean: config.clean,
  source: config.source,
  dbPath: config.dbPath,
});

console.log("done. See data/marloth.sqlite and docs/notion-import-manifest.json");
