import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { extractNotionId } from "./ids";

/** List files under root; uses find(1) so mojibake zip paths are not dropped. */
export function findExportFiles(root: string, pred: (p: string) => boolean): string[] {
  try {
    const out = execFileSync("find", [root, "-type", "f"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split("\n")
      .filter((line) => line.length > 0 && pred(line))
      .sort();
  } catch {
    return findExportFilesWalk(root, pred);
  }
}

function findExportFilesWalk(root: string, pred: (p: string) => boolean): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      try {
        if (ent.isDirectory()) walk(p);
        else if (ent.isFile() && pred(p)) out.push(p);
      } catch {
        /* skip unreadable entries */
      }
    }
  }
  walk(root);
  return out.sort();
}

/** Read export text; falls back to find(1)+cat when Node cannot open mojibake paths. */
export function readExportText(absPath: string, searchRoot?: string): string {
  try {
    return readFileSync(absPath, { encoding: "utf-8" });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
    const notionId = extractNotionId(basename(absPath));
    if (!notionId) throw e;
    const ext = absPath.includes(".") ? absPath.slice(absPath.lastIndexOf(".")) : "";
    const roots = searchRoot ? [searchRoot] : [dirname(absPath)];
    for (const root of roots) {
      try {
        return execFileSync(
          "find",
          [root, "-name", `*${notionId}${ext}`, "-exec", "cat", "{}", "+"],
          { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
        );
      } catch {
        /* try next root */
      }
    }
    throw e;
  }
}
