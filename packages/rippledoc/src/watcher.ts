import chokidar from "chokidar";
import { relative } from "node:path";
import type { ResolvedConfig } from "./config";
import { runPipelineForPath, type ChangeKind } from "./pipeline";
import {
  createAuditState,
  recordFingerprint,
  seedSnapshot,
  startAuditTimer,
} from "./audit";

function isIgnoredPath(p: string): boolean {
  return (
    p.includes(`${"node_modules"}`) ||
    p.includes("/node_modules/") ||
    p.includes("/dist/") ||
    p.includes("/.git/")
  );
}

export function runWatcher(config: ResolvedConfig): {
  watcher: chokidar.FSWatcher;
  close: () => Promise<void>;
} {
  const contentDir = config.contentDir;
  const audit = config.watchMode === "audit";
  const auditState = createAuditState();

  const debouncers = new Map<string, ReturnType<typeof setTimeout>>();

  function schedule(
    absPath: string,
    kind: ChangeKind,
    after: () => Promise<void>,
  ): void {
    const prev = debouncers.get(absPath);
    if (prev !== undefined) clearTimeout(prev);
    const t = setTimeout(() => {
      debouncers.delete(absPath);
      void (async () => {
        try {
          await after();
        } catch (e) {
          console.error("[rippledoc]", absPath, e);
        }
      })();
    }, config.debounceMs);
    debouncers.set(absPath, t);
  }

  const watcher = chokidar.watch(contentDir, {
    ignoreInitial: true,
    usePolling: config.watchMode === "polling",
    interval: config.pollIntervalMs,
    binaryInterval: config.pollIntervalMs,
    ignored: (p) => isIgnoredPath(p),
  });

  let auditHandle: ReturnType<typeof setInterval> | undefined;
  if (audit) {
    void seedSnapshot(auditState, contentDir).then(() => {
      console.log(
        "[rippledoc] audit mode: initial snapshot; native chokidar + polling reconciliation",
      );
      auditHandle = startAuditTimer(auditState, config);
    });
  }

  const onFile = (absPath: string, ev: string) => {
    if (!absPath.endsWith(".md")) return;
    if (isIgnoredPath(absPath)) return;
    const k = kindFromEvent(ev);
    schedule(absPath, k, async () => {
      await runPipelineForPath(absPath, k);
      if (audit) {
        if (k === "unlink") {
          const rel = relative(contentDir, absPath);
          auditState.delete(rel);
        } else {
          await recordFingerprint(auditState, contentDir, absPath);
        }
      }
    });
  };

  for (const ev of ["add", "change", "unlink"] as const) {
    watcher.on(ev, (p) => onFile(p, ev));
  }

  return {
    watcher,
    close: async () => {
      if (auditHandle) clearInterval(auditHandle);
      await watcher.close();
    },
  };
}
