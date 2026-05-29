import { openMarlothWriteContext } from "marloth-db";
import { resolve } from "node:path";
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
  const contentPath = process.env.MARLOTH_CONTENT_PATH ?? resolve(repoRoot, "content");
  const ctx = openMarlothWriteContext(contentPath, config.dbPath);

  try {
    if (opts.command === "pages") {
      const summary = await syncPages(ctx, client, config.rootPageId, opts);
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
      const summary = await syncDatabases(ctx, client, opts);
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
    ctx.db.close();
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  run(argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
