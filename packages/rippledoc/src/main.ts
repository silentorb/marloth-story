import { existsSync } from "node:fs";
import { readConfig, printHelp } from "./config";
import { runWatcher } from "./watcher";

const result = readConfig(process.argv.slice(2));
if (result.help) {
  printHelp();
  process.exit(0);
}
const { config } = result;

if (!existsSync(config.contentDir)) {
  console.error(
    `rippledoc: content directory not found: ${config.contentDir}`,
  );
  process.exit(1);
}

console.log(
  `[rippledoc] mode=${config.watchMode} watching ${config.contentDirRel} (repo ${config.repoRoot})`,
);

const { close } = runWatcher(config);

const shutdown = () => {
  void close().then(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
