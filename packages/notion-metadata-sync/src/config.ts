import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const DEFAULT_NOTION_ROOT_PAGE_ID = "72b6fb455b824b78962b0e509cc091c9";
export const DEFAULT_NOTION_API_VERSION = "2022-06-28";
export const DEFAULT_DB_PATH = "data/marloth.sqlite";

export interface SyncConfig {
  repoRoot: string;
  apiKey: string;
  apiVersion: string;
  rootPageId: string;
  dbPath: string;
}

export interface SyncOptions {
  dryRun: boolean;
  force: boolean;
  limit?: number;
  id?: string;
  enrichRows: boolean;
}

export function defaultRepoRoot(): string {
  return resolve(import.meta.dir, "../../..");
}

/** Parse simple KEY=VALUE lines from a dotenv-style file. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadDevcontainerEnv(repoRoot: string): Record<string, string> {
  const path = join(repoRoot, ".devcontainer", "notion.env");
  if (!existsSync(path)) return {};
  return parseEnvFile(readFileSync(path, "utf8"));
}

export function resolveSyncConfig(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): SyncConfig {
  const fileEnv = loadDevcontainerEnv(repoRoot);
  const apiKey = fileEnv.NOTION_API_KEY ?? env.NOTION_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "Missing NOTION_API_KEY. Copy .devcontainer/notion.env.example to .devcontainer/notion.env and set your integration token.",
    );
  }
  return {
    repoRoot,
    apiKey: apiKey.trim(),
    apiVersion:
      fileEnv.NOTION_API_VERSION ??
      env.NOTION_API_VERSION ??
      DEFAULT_NOTION_API_VERSION,
    rootPageId: (
      fileEnv.NOTION_ROOT_PAGE_ID ??
      env.NOTION_ROOT_PAGE_ID ??
      DEFAULT_NOTION_ROOT_PAGE_ID
    ).toLowerCase(),
    dbPath: resolve(repoRoot, env.MARLOTH_DB_PATH ?? DEFAULT_DB_PATH),
  };
}

export function parseArgv(argv: string[]): SyncOptions & { command?: string; help: boolean } {
  const opts: SyncOptions & { command?: string; help: boolean } = {
    dryRun: false,
    force: false,
    enrichRows: false,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      opts.dryRun = true;
      i += 1;
      continue;
    }
    if (arg === "--force") {
      opts.force = true;
      i += 1;
      continue;
    }
    if (arg === "--enrich-rows") {
      opts.enrichRows = true;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      opts.limit = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 2;
      continue;
    }
    if (arg === "--id") {
      opts.id = (argv[i + 1] ?? "").toLowerCase();
      i += 2;
      continue;
    }
    if (!arg.startsWith("-") && !opts.command) {
      opts.command = arg;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return opts;
}

export const HELP_TEXT = `Usage: notion-metadata-sync <command> [options]

Commands:
  pages      Sync page created_at, modified_at, notion_url from Notion API
  databases  Sync NotionDatabase schema and views from Notion API

Options:
  --dry-run       Print summary without writing to SQLite
  --force         Overwrite existing timestamp properties (pages) or refresh schema (databases)
  --limit N       Process at most N records
  --id HEX        Sync a single 32-hex record id
  --enrich-rows   (databases) Query Notion for row cell values including formulas
  -h, --help      Show this help
`;
