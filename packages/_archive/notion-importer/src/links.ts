import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as textutil from "./textutil";

const NOTION_PAREN_LINK =
  /(?<!\[)([^\[\]\n(]+?)\s*\(\s*([^)]+?\.(?:md|csv))(?:#([^)]*))?\s*\)(?!\])/gi;

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

function normKey(p: string): string {
  return resolve(p);
}

export function unquotePath(s: string): string {
  let out = s.trim();
  if (out.startsWith("<") && out.endsWith(">")) out = out.slice(1, -1);
  return decodeURIComponent(out);
}

export function buildTargetToOutput(
  mdSources: string[],
  repoRoot: string,
): [Record<string, string>, Record<string, string>] {
  const byResolved: Record<string, string> = {};
  const idTo: Record<string, string> = {};
  for (const p of mdSources) {
    const rp = resolve(repoRoot, p);
    const key = normKey(rp);
    const base = textutil.urlFriendlyBasename(p.split("/").pop()!);
    byResolved[key] = base;
    const m = /([a-f0-9]{32})\.md$/i.exec(base);
    if (m) idTo[m[1]!.toLowerCase()] = base;
  }
  return [byResolved, idTo];
}

export function resolveTarget(
  targetRaw: string,
  sourceFile: string,
  repoRoot: string,
  byResolved: Record<string, string>,
  idToBasename: Record<string, string>,
  csvToOutput?: Record<string, string> | null,
): string | null {
  const raw = unquotePath(targetRaw);
  if (!raw || raw.startsWith("#") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return null;
  }
  if (raw.startsWith("mailto:")) return null;

  const src = resolve(sourceFile.startsWith("/") ? sourceFile : resolve(repoRoot, sourceFile));
  let sourceParent: string;
  try {
    sourceParent = statSync(src).isFile() ? dirname(src) : src;
  } catch {
    sourceParent = src;
  }
  const tpath = resolve(sourceParent, raw);
  const tkey = normKey(tpath);
  if (tkey in byResolved) return byResolved[tkey]!;
  if (csvToOutput && tkey in csvToOutput) return csvToOutput[tkey]!;
  const m = /([a-f0-9]{32})(?:\.(?:md|csv))/i.exec(raw);
  if (m && m[1]!.toLowerCase() in idToBasename) {
    return idToBasename[m[1]!.toLowerCase()]!;
  }
  return null;
}

export function linkTargetBasename(toBasename: string, anchor: string | null): string {
  const a = anchor ? `#${anchor}` : "";
  if (
    toBasename.includes(" ") ||
    /[\[\]()&:]/u.test(toBasename)
  ) {
    return `${encodeURIComponent(toBasename).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}${a}`;
  }
  return toBasename + a;
}

export function rewriteNotionLinksInText(
  text: string,
  sourceRelpath: string,
  repoRoot: string,
  byResolved: Record<string, string>,
  idToBasename: Record<string, string>,
  csvToOutput?: Record<string, string> | null,
): [string, string[]] {
  const sourceFile = resolve(repoRoot, sourceRelpath);
  const outErrs: string[] = [];

  const out = text.replace(NOTION_PAREN_LINK, (match, label: string, pathPart: string, anc?: string) => {
    const toBase = resolveTarget(
      pathPart.trim(),
      sourceFile,
      repoRoot,
      byResolved,
      idToBasename,
      csvToOutput,
    );
    if (!toBase) {
      outErrs.push(`unresolved: ${pathPart} in ${sourceRelpath}`);
      return match;
    }
    const href = linkTargetBasename(toBase, anc ?? null);
    return `[${label.trim()}](${href})`;
  });
  return [out, outErrs];
}

export function rewriteMarkdownHrefs(
  text: string,
  sourceRelpath: string,
  repoRoot: string,
  byResolved: Record<string, string>,
  idToBasename: Record<string, string>,
  csvToOutput?: Record<string, string> | null,
): string {
  const sourceFile = resolve(repoRoot, sourceRelpath);

  return text.replace(MD_LINK, (match, label: string, inner: string) => {
    if (
      inner.startsWith("#") ||
      inner.startsWith("http://") ||
      inner.startsWith("https://") ||
      inner.startsWith("mailto:")
    ) {
      return match;
    }
    const hashIdx = inner.indexOf("#");
    const pathonly = hashIdx >= 0 ? inner.slice(0, hashIdx) : inner;
    const anchor = hashIdx >= 0 ? inner.slice(hashIdx + 1) : "";
    const decoded = unquotePath(pathonly.trim());
    if (!decoded) return match;
    const toBase = resolveTarget(
      decoded,
      sourceFile,
      repoRoot,
      byResolved,
      idToBasename,
      csvToOutput,
    );
    if (!toBase) return match;
    const href = linkTargetBasename(toBase, anchor || null);
    return `[${label}](${href})`;
  });
}

export function rewriteAllLinks(
  text: string,
  sourceRelpath: string,
  repoRoot: string,
  byResolved: Record<string, string>,
  idToBasename: Record<string, string>,
  csvToOutput?: Record<string, string> | null,
): [string, string[]] {
  const errs: string[] = [];
  let current = text;
  for (let pass = 0; pass < 16; pass += 1) {
    const prev = current;
    const [next, e] = rewriteNotionLinksInText(
      current,
      sourceRelpath,
      repoRoot,
      byResolved,
      idToBasename,
      csvToOutput,
    );
    errs.push(...e);
    current = rewriteMarkdownHrefs(
      next,
      sourceRelpath,
      repoRoot,
      byResolved,
      idToBasename,
      csvToOutput,
    );
    if (current === prev) break;
  }
  return [current, errs];
}
