import { watch, type FSWatcher } from "node:fs";
import type { CacheSync } from "./sync";
import { CONNECTIONS_FILENAME, DYNAMIC_FIELDS_FILENAME, NODE_FILE_PATTERN } from "./paths";

const DEBOUNCE_MS = 200;

export class ContentWatcher {
  private watcher: FSWatcher | null = null;
  private pending = new Map<string, ReturnType<typeof setTimeout>>();
  private closed = false;

  constructor(
    private readonly sync: CacheSync,
    private readonly onError?: (err: Error) => void,
  ) {}

  start(): void {
    if (this.watcher) return;
    const contentDir = this.sync.contentDir;
    try {
      this.watcher = watch(contentDir, (event, filename) => {
        if (this.closed || !filename || typeof filename !== "string") return;
        if (!this.isRelevantFile(filename)) return;
        this.schedule(filename);
      });
      this.watcher.on("error", (err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)));
      });
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private isRelevantFile(name: string): boolean {
    return (
      name === CONNECTIONS_FILENAME ||
      name === DYNAMIC_FIELDS_FILENAME ||
      NODE_FILE_PATTERN.test(name)
    );
  }

  private schedule(filename: string): void {
    const existing = this.pending.get(filename);
    if (existing) clearTimeout(existing);
    this.pending.set(
      filename,
      setTimeout(() => {
        this.pending.delete(filename);
        if (this.closed || this.sync.isApplying()) return;
        try {
          this.sync.syncFile(filename);
        } catch (err) {
          this.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }, DEBOUNCE_MS),
    );
  }

  close(): void {
    this.closed = true;
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    this.watcher?.close();
    this.watcher = null;
  }
}
