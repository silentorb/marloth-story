import { resolve, join, relative } from "node:path";

export type WatchMode = "native" | "polling" | "audit";

export interface ResolvedConfig {
  watchMode: WatchMode;
  repoRoot: string;
  contentDir: string;
  contentDirRel: string;
  debounceMs: number;
  pollIntervalMs: number;
  auditIntervalMs: number;
}

const DEFAULT_DEBOUNCE = 200;
const DEFAULT_POLL = 1000;
const DEFAULT_AUDIT = 5000;

function envString(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const v = env[key];
  return v === undefined || v === "" ? undefined : v;
}

function envStringFirst(
  keys: string[],
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const k of keys) {
    const v = envString(k, env);
    if (v !== undefined) return v;
  }
  return undefined;
}

function parseWatchMode(s: string): WatchMode {
  const x = s.trim().toLowerCase();
  if (x === "native" || x === "no_polling" || x === "1") return "native";
  if (x === "polling" || x === "poll_update" || x === "2") return "polling";
  if (x === "audit" || x === "poll_warn_if_missed" || x === "3")
    return "audit";
  throw new Error(
    `Invalid watch mode "${s}" (use native, polling, or audit).`,
  );
}

function parseIntEnvFirst(
  keys: string[],
  def: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  for (const key of keys) {
    const v = envString(key, env);
    if (v === undefined) continue;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n) || n < 0) {
      throw new Error(`Invalid integer for ${key}: "${v}"`);
    }
    return n;
  }
  return def;
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
        const k = a.slice(2, eq);
        const v = a.slice(eq + 1);
        kv.set(k, v);
        i += 1;
        continue;
      }
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        kv.set(k, "true");
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

/**
 * Merges: CLI (kv) overrides env, env overrides defaults.
 */
function buildResolvedConfig(
  kv: Map<string, string | boolean>,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedConfig {
  const rawRoot = kv.get("repo-root");
  const repoFromCli =
    typeof rawRoot === "string" ? rawRoot : undefined;
  const repoFromEnv = envStringFirst(
    ["RIPPLEDOC_REPO_ROOT", "MARLOTH_REPO_ROOT"],
    env,
  );
  const repoRoot = resolve(
    repoFromCli ?? repoFromEnv ?? process.cwd(),
  );

  const rawContent = kv.get("content-dir");
  const contentFromCli =
    typeof rawContent === "string" ? rawContent : undefined;
  const contentRel =
    contentFromCli ??
    envStringFirst(["RIPPLEDOC_CONTENT_DIR", "MARLOTH_CONTENT_DIR"], env) ??
    "content";
  const contentDir = join(repoRoot, contentRel);
  const contentDirRel = relative(repoRoot, contentDir) || "content";

  const rawMode = kv.get("watch-mode");
  const modeFromCli =
    typeof rawMode === "string" ? rawMode : undefined;
  const modeStr =
    modeFromCli ??
    envStringFirst(
      ["RIPPLEDOC_WATCH_MODE", "MARLOTH_WATCH_MODE", "WATCH_MODE"],
      env,
    ) ??
    "native";
  const watchMode = parseWatchMode(modeStr);

  const debounceFromCli = kv.get("debounce-ms");
  const debounceMs =
    debounceFromCli !== undefined
      ? Number.parseInt(String(debounceFromCli), 10)
      : parseIntEnvFirst(
          ["RIPPLEDOC_DEBOUNCE_MS", "MARLOTH_DEBOUNCE_MS"],
          DEFAULT_DEBOUNCE,
          env,
        );
  if (Number.isNaN(debounceMs) || debounceMs < 0) {
    throw new Error("debounce-ms must be a non-negative integer");
  }

  const pollFromCli = kv.get("poll-interval-ms");
  const pollIntervalMs =
    pollFromCli !== undefined
      ? Number.parseInt(String(pollFromCli), 10)
      : parseIntEnvFirst(
          ["RIPPLEDOC_POLL_INTERVAL_MS", "MARLOTH_POLL_INTERVAL_MS"],
          DEFAULT_POLL,
          env,
        );
  if (Number.isNaN(pollIntervalMs) || pollIntervalMs < 50) {
    throw new Error("poll-interval-ms must be an integer >= 50");
  }

  const auditFromCli = kv.get("audit-interval-ms");
  const auditIntervalMs =
    auditFromCli !== undefined
      ? Number.parseInt(String(auditFromCli), 10)
      : parseIntEnvFirst(
          ["RIPPLEDOC_AUDIT_INTERVAL_MS", "MARLOTH_AUDIT_INTERVAL_MS"],
          DEFAULT_AUDIT,
          env,
        );
  if (Number.isNaN(auditIntervalMs) || auditIntervalMs < 200) {
    throw new Error("audit-interval-ms must be an integer >= 200");
  }

  return {
    watchMode,
    repoRoot,
    contentDir,
    contentDirRel,
    debounceMs,
    pollIntervalMs,
    auditIntervalMs,
  };
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
    "rippledoc — watch content/ and run the content pipeline; changes ripple through linked documents",
    "",
    "Usage: rippledoc [options]",
    "",
    "Options (also settable via environment; RIPPLEDOC_* is preferred, MARLOTH_* is legacy):",
    "  --watch-mode <mode>   native | polling | audit",
    "                        env: RIPPLEDOC_WATCH_MODE, or MARLOTH_WATCH_MODE or WATCH_MODE",
    "  --repo-root <path>  repository root (default: cwd). env: RIPPLEDOC_REPO_ROOT or MARLOTH_REPO_ROOT",
    "  --content-dir <rel>  relative to repo (default: content). env: RIPPLEDOC_CONTENT_DIR or MARLOTH_CONTENT_DIR",
    "  --debounce-ms <n>   debounce (default: 200). env: RIPPLEDOC_DEBOUNCE_MS or MARLOTH_DEBOUNCE_MS",
    "  --poll-interval-ms <n> chokidar polling & binary interval in polling mode (default: 1000). env: RIPPLEDOC_POLL_INTERVAL_MS or MARLOTH_POLL_INTERVAL_MS",
    "  --audit-interval-ms <n>  reconciliation scan in audit mode (default: 5000). env: RIPPLEDOC_AUDIT_INTERVAL_MS or MARLOTH_AUDIT_INTERVAL_MS",
    "  -h, --help",
    "",
    "Precedence: CLI flags > environment > defaults.",
  ];
  console.log(lines.join("\n"));
}
