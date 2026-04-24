import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { statFingerprint } from "./fingerprint";
import type { ResolvedConfig } from "./config";

export function createAuditState(): Map<string, string> {
  return new Map();
}

/**
 * After pipeline or on startup, record disk identity for a path (relative to content dir).
 */
export async function recordFingerprint(
  state: Map<string, string>,
  contentDir: string,
  absPath: string,
): Promise<void> {
  const rel = relative(contentDir, absPath);
  if (rel.startsWith("..") || rel.includes("..")) return;
  const fp = await statFingerprint(absPath);
  state.set(rel, fp);
}

/**
 * Build initial snapshot of all `*.md` in the flat `content` directory.
 */
export async function seedSnapshot(
  state: Map<string, string>,
  contentDir: string,
): Promise<void> {
  const names = await readdir(contentDir);
  for (const n of names) {
    if (!n.endsWith(".md")) continue;
    const abs = join(contentDir, n);
    await recordFingerprint(state, contentDir, abs);
  }
}

/**
 * Reconcile: warn if a file on disk no longer matches our snapshot (missed chokidar).
 * Does not run the main pipeline. Updates snapshot to match disk after a warning
 * to avoid log spam.
 */
export async function runReconciliation(
  state: Map<string, string>,
  config: ResolvedConfig,
): Promise<void> {
  const { contentDir } = config;
  const names = await readdir(contentDir);
  for (const n of names) {
    if (!n.endsWith(".md")) continue;
    const abs = join(contentDir, n);
    const rel = n;
    const cur = await statFingerprint(abs);
    const prev = state.get(rel);
    if (prev === undefined) {
      console.warn(
        `[watch-audit] new file on disk not seen from watcher before this scan: content/${rel}`,
      );
    } else if (prev !== cur) {
      console.warn(
        `[watch-audit] possible missed change (chokidar did not deliver before this scan): content/${rel} expected ${prev} saw ${cur}`,
      );
    }
    state.set(rel, cur);
  }
}

export function startAuditTimer(
  state: Map<string, string>,
  config: ResolvedConfig,
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    void runReconciliation(state, config).catch((e: unknown) => {
      console.error("[watch-audit] reconciliation error", e);
    });
  }, config.auditIntervalMs);
}
