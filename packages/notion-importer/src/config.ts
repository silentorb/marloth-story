import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ResolvedConfig {
  repoRoot: string;
  source?: string;
  clean: boolean;
}

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_REPO = resolve(PACKAGE_ROOT, "../..");

function envString(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const v = env[key];
  return v === undefined || v === "" ? undefined : v;
}

export interface ArgParseResult {
  help: boolean;
  kv: Map<string, string | boolean>;
}

function parseArgKv(argv: string[]): ArgParseResult {
  const kv = new Map<string, string | boolean>();
  let i = 0;
  let help = false;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") {
      help = true;
      i += 1;
      continue;
    }
    if (a === "--") {
      i += 1;
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        kv.set(a.slice(2, eq), a.slice(eq + 1));
        i += 1;
        continue;
      }
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        kv.set(k, true);
        i += 1;
      } else {
        kv.set(k, next);
        i += 2;
      }
      continue;
    }
    i += 1;
  }
  return { help, kv };
}

function resolveSourceArg(path: string | undefined, repoRoot: string): string | undefined {
  if (!path) return undefined;
  return resolve(path.startsWith("/") ? path : join(repoRoot, path));
}

function buildResolvedConfig(
  kv: Map<string, string | boolean>,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedConfig {
  const rawRepo = kv.get("repo");
  const repoFromCli = typeof rawRepo === "string" ? rawRepo : undefined;
  const repoRoot = resolve(repoFromCli ?? DEFAULT_REPO);

  const rawSource = kv.get("source");
  const sourceFromCli = typeof rawSource === "string" ? rawSource : undefined;
  const source = resolveSourceArg(sourceFromCli ?? envString("NOTION_EXPORT_DIR", env), repoRoot);

  const clean = kv.has("clean");

  return { repoRoot, source, clean };
}

export function readConfig(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): { help: true } | { help: false; config: ResolvedConfig } {
  const { help, kv } = parseArgKv(argv);
  if (help) return { help: true };
  return { help: false, config: buildResolvedConfig(kv, env) };
}

export function printHelp(): void {
  const lines = [
    "notion-importer — Notion export → flat content/ markdown",
    "",
    "Usage: notion-importer [options]",
    "",
    "Options (CLI overrides environment):",
    "  --repo <path>     Repository root (default: marloth-story repo root)",
    "  --source <path>   Notion export directory or .zip (overrides exports/)",
    "  --clean           Delete all content/*.md before import",
    "  -h, --help",
    "",
    "Environment:",
    "  NOTION_EXPORT_DIR  Export directory or zip when --source is omitted",
    "",
    "Source resolution order: --source → NOTION_EXPORT_DIR → newest ./exports/ → ./external/notion/",
  ];
  console.log(lines.join("\n"));
}
