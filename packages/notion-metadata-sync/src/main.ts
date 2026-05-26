import { GraphDatabase } from "marloth-db";
import { resolveSyncConfig, parseArgv, defaultRepoRoot, HELP_TEXT } from "./config";
import { NotionReadClient } from "./notion-client";
import { syncPages } from "./sync-pages";
import { syncDatabases } from "./sync-databases";

export async function run(argv: string[]): Promise<void> {
  const opts = parseArgv(argv);
  if (opts.help || !opts.command) {
    console.log(HELP_TEXT);
    process.exit(opts.help ? 0 : 1);
  }

  const repoRoot = defaultRepoRoot();
  const config = resolveSyncConfig(repoRoot);
  const client = new NotionReadClient(config.apiKey, config.apiVersion);
  const db = new GraphDatabase(config.dbPath);

  try {
    if (opts.command === "pages") {
      const summary = await syncPages(db, client, config.rootPageId, opts);
      console.log(
        `Pages: scanned=${summary.scanned} updated=${summary.updated} skipped=${summary.skipped} errors=${summary.errors.length}`,
      );
      if (summary.errors.length > 0) {
        for (const err of summary.errors.slice(0, 10)) {
          console.error(`  ${err.id}: ${err.message}`);
        }
      }
      return;
    }

    if (opts.command === "databases") {
      const summary = await syncDatabases(db, client, opts);
      console.log(
        `Databases: scanned=${summary.scanned} updated=${summary.updated} skipped=${summary.skipped} errors=${summary.errors.length}`,
      );
      if (summary.errors.length > 0) {
        for (const err of summary.errors.slice(0, 10)) {
          console.error(`  ${err.id}: ${err.message}`);
        }
      }
      return;
    }

    throw new Error(`Unknown command: ${opts.command}`);
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  run(argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
