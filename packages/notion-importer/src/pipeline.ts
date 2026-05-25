import {
  createHash,
} from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { extractNotionId } from "./ids";
import * as indexes from "./indexes";
import { buildTargetToOutput, rewriteAllLinks } from "./links";
import { splitNotionPage } from "./parse";
import { gfmTable } from "./tables";
import * as textutil from "./textutil";
import { formatFrontMatter } from "./yamlfmt";

const PROP_LINE = /^(.{1,200}?):\s+(.*)\s*$/;

export interface RunOptions {
  repoRoot: string;
  clean?: boolean;
  source?: string;
}

export interface ManifestEntry {
  notion_id?: string;
  source_export?: string;
  output?: string;
  inferred_notion_path?: string;
  type?: string;
  notion_database?: string;
}

export interface Manifest {
  version: number;
  files: Record<string, ManifestEntry>;
}

function stripLineKeyEmojis(line: string): string {
  const m = PROP_LINE.exec(line);
  if (!m) return line;
  return `${textutil.stripEmojis(m[1]!)}: ${m[2]!}`;
}

function primaryAlias(title: string, notionId: string): string {
  const t = title.trim();
  const suff = ` ${notionId}`;
  if (t.toLowerCase().endsWith(suff.toLowerCase())) return t.slice(0, -suff.length);
  const m = / ([a-f0-9]{32})$/i.exec(t);
  if (m && m[1]!.toLowerCase() === notionId) return t.slice(0, m.index);
  return t;
}

export function processMarkdownFile(
  absMd: string,
  sourceReposix: string,
): [string, string, ManifestEntry] {
  const text = readFileSync(absMd, { encoding: "utf-8" });
  const sp = splitNotionPage(text);
  const nid = extractNotionId(basename(absMd));
  if (!nid) throw new Error(`no notion id in ${absMd}`);

  const outName = textutil.urlFriendlyBasename(basename(absMd));

  const fm: Record<string, unknown> = {
    title: sp.h1Text,
    notion_id: nid,
    aliases: [primaryAlias(sp.h1Text, nid)],
    source_export: sourceReposix,
  };
  if (sourceReposix.startsWith("external/notion/")) {
    fm.inferred_notion_path = dirname(sourceReposix.slice("external/notion/".length));
  } else if (sourceReposix.startsWith("exports/")) {
    fm.inferred_notion_path = dirname(sourceReposix.slice("exports/".length));
  }

  for (const [rawK, val] of sp.scalarProperties) {
    let key = textutil.slugifyKey(rawK);
    if (key in fm) key = `prop_${key}`;
    fm[key] = val;
  }

  const bodyLines = sp.bodyLines.map(stripLineKeyEmojis);
  let body = bodyLines.join("\n");
  if (body.trim()) body = `${sp.h1}\n\n${body}`;
  else body = sp.h1;

  const out = formatFrontMatter(fm) + body;
  const mentry: ManifestEntry = {
    notion_id: nid,
    source_export: sourceReposix,
    inferred_notion_path: fm.inferred_notion_path as string | undefined,
  };
  return [outName, out, mentry];
}

function planIndexFilename(
  csvName: string,
  seen: Set<string>,
  relposix: string,
): [string, indexes.ParsedCsvBasename | null, string, string] {
  const parsed = indexes.parseCsvBasename(csvName);
  let vkey = "unparsed";
  let outIdx: string;
  if (!parsed) {
    const h0 = createHash("sha256").update(relposix).digest("hex").slice(0, 12);
    outIdx = `index-${h0}-unparsed.md`;
  } else {
    vkey = parsed.viewKey;
    outIdx = indexes.indexOutFilename(parsed.databaseId, vkey);
  }
  if (seen.has(outIdx)) {
    const h = createHash("sha256").update(relposix).digest("hex").slice(0, 8);
    const dbpart = parsed ? parsed.databaseId : h;
    const vk = vkey.replace(/_/g, "-").toLowerCase();
    outIdx = `index-${dbpart}-${vk}-${h}.md`;
  }
  seen.add(outIdx);
  return [outIdx, parsed, vkey, relposix];
}

function linkCheck(srcDir: string): string[] {
  const err: string[] = [];
  const files = readdirSync(srcDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const name of files) {
    const p = join(srcDir, name);
    const t = readFileSync(p, { encoding: "utf-8" });
    let m: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(t)) !== null) {
      const href = m[2]!.trim();
      if (!href || /^[#]|^https?:\/\//.test(href) || href.startsWith("mailto:")) continue;
      const pathonly = decodeURIComponent(href.split("#", 1)[0]!);
      if (!pathonly) continue;
      const tgt = resolve(dirname(p), pathonly);
      try {
        statSync(tgt);
      } catch {
        err.push(`${name}: missing ${pathonly}`);
      }
    }
  }
  return err;
}

async function runUnzip(zipPath: string, destDir: string): Promise<void> {
  const proc = Bun.spawn(["unzip", "-q", "-o", zipPath, "-d", destDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`unzip failed for ${zipPath}: ${err}`);
  }
}

async function unpackNestedArchives(root: string, maxRounds = 32): Promise<void> {
  for (let round = 0; round < maxRounds; round += 1) {
    const zips = findFiles(root, (p) => p.endsWith(".zip"));
    if (zips.length === 0) return;
    zips.sort((a, b) => b.split("/").length - a.split("/").length);
    for (const zpath of zips) {
      await runUnzip(zpath, dirname(zpath));
      unlinkSync(zpath);
    }
  }
  throw new Error(`nested zip extraction exceeded ${maxRounds} rounds`);
}

function findFiles(root: string, pred: (p: string) => boolean): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && pred(p)) out.push(p);
    }
  }
  walk(root);
  return out;
}

async function extractExportArchive(srcPath: string): Promise<[string, string]> {
  const tempdir = mkdtempSync(join(tmpdir(), "notion-export-"));
  try {
    await runUnzip(srcPath, tempdir);
    await unpackNestedArchives(tempdir);
  } catch (e) {
    rmSync(tempdir, { recursive: true, force: true });
    throw e;
  }
  return [tempdir, tempdir];
}

function makeReposix(
  absP: string,
  repoRoot: string,
  external: string,
  sourceLabel: string,
): string {
  const resolved = resolve(absP);
  const relToRepo = relative(repoRoot, resolved);
  if (relToRepo && !relToRepo.startsWith("..")) return relToRepo.split("\\").join("/");
  const rel = relative(external, resolved);
  return `${sourceLabel}/${rel.split("\\").join("/")}`;
}

function resolveSourcePath(repoRoot: string, source?: string): string {
  if (source) {
    return resolve(source.startsWith("/") ? source : join(repoRoot, source));
  }
  const envSrc = process.env.NOTION_EXPORT_DIR;
  if (envSrc) return resolve(envSrc);
  const exportsDir = join(repoRoot, "exports");
  try {
    const entries = readdirSync(exportsDir).map((name) => join(exportsDir, name));
    if (entries.length > 0) {
      entries.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      return entries[0]!;
    }
  } catch {
    /* no exports dir */
  }
  return resolve(repoRoot, "external", "notion");
}

export async function run(opts: RunOptions): Promise<void> {
  const repoRoot = resolve(opts.repoRoot);
  const srcPath = resolveSourcePath(repoRoot, opts.source);

  let tempdir: string | null = null;
  let external: string;
  if (statSync(srcPath).isFile() && srcPath.toLowerCase().endsWith(".zip")) {
    [external, tempdir] = await extractExportArchive(srcPath);
  } else {
    external = resolve(srcPath);
  }

  const outRoot = resolve(repoRoot, "content");
  const docs = resolve(repoRoot, "docs");

  if (!statSync(external).isDirectory()) {
    throw new Error(`missing ${external}`);
  }

  if (opts.clean) {
    try {
      for (const child of readdirSync(outRoot)) {
        if (child.endsWith(".md")) unlinkSync(join(outRoot, child));
      }
    } catch {
      /* content dir may not exist */
    }
  }

  mkdirSync(outRoot, { recursive: true });
  mkdirSync(docs, { recursive: true });

  const mdFiles = findFiles(external, (p) => p.endsWith(".md")).sort();

  const externalResolved = resolve(external);
  const repoResolved = resolve(repoRoot);
  let sourceLabel: string;
  const relExternal = relative(repoResolved, externalResolved);
  if (relExternal && !relExternal.startsWith("..")) {
    sourceLabel = relExternal.split("\\").join("/");
  } else if (basename(dirname(srcPath)) === "exports") {
    sourceLabel = `exports/${basename(srcPath)}`;
  } else {
    sourceLabel = "external/notion";
  }

  const sourceRelpaths = mdFiles.map((p) =>
    makeReposix(p, repoRoot, external, sourceLabel),
  );
  const [byResolved, idTo] = buildTargetToOutput(sourceRelpaths, repoRoot);

  const manifest: Manifest = { version: 1, files: {} };
  const allOutputs: [string, string, string, string][] = [];

  for (const absMd of mdFiles) {
    const relposix = makeReposix(absMd, repoRoot, external, sourceLabel);
    const [outName, content, mentry] = processMarkdownFile(absMd, relposix);
    mentry.output = `content/${outName}`;
    manifest.files[outName] = mentry;
    allOutputs.push([join(outRoot, outName), content, relposix, "page"]);
  }

  for (const [outP, text] of allOutputs.map(([p, t]) => [p, t] as const)) {
    writeFileSync(outP, textutil.sanitizeUtf8(text), { encoding: "utf-8" });
  }

  const csvFiles = findFiles(external, (p) => p.endsWith(".csv")).sort();
  const seenIndexNames = new Set<string>();
  const csvToOutput: Record<string, string> = {};
  const indexPlans: [
    string,
    string,
    indexes.ParsedCsvBasename | null,
    string,
    string,
  ][] = [];

  for (const csvp of csvFiles) {
    const relposix = makeReposix(csvp, repoRoot, external, sourceLabel);
    const [outIdx, parsed, vkey, relp] = planIndexFilename(
      basename(csvp),
      seenIndexNames,
      relposix,
    );
    csvToOutput[resolve(csvp)] = outIdx;
    indexPlans.push([csvp, outIdx, parsed, vkey, relp]);
  }

  for (const [csvp, outIdx, parsed, vkey, relp] of indexPlans) {
    const ttitle = `Index: ${basename(csvp, ".csv")} (${vkey})`;
    const [headers, rows] = indexes.readCsvRows(csvp);
    if (headers.length === 0) continue;
    const fmd: Record<string, unknown> = {
      title: ttitle,
      type: "notion-index",
      view: vkey,
      source_export: relp,
    };
    if (parsed) fmd.notion_database = parsed.databaseId;
    const table = gfmTable(headers, rows);
    const content = `${formatFrontMatter(fmd)}# ${ttitle}\n\n${table}`;
    const ip = join(outRoot, outIdx);
    writeFileSync(ip, textutil.sanitizeUtf8(content), { encoding: "utf-8" });
    const entry: ManifestEntry = {
      type: "notion-index",
      source_export: relp,
      output: `content/${outIdx}`,
    };
    if (parsed) entry.notion_database = parsed.databaseId;
    manifest.files[outIdx] = entry;
  }

  const allErr: string[] = [];
  for (const name of readdirSync(outRoot)) {
    if (!name.endsWith(".md")) continue;
    const p = join(outRoot, name);
    const m = manifest.files[name];
    const srcExp = m?.source_export;
    if (!srcExp) continue;
    const t = readFileSync(p, { encoding: "utf-8" });
    const [n, errs] = rewriteAllLinks(
      t,
      srcExp,
      repoRoot,
      byResolved,
      idTo,
      csvToOutput,
    );
    writeFileSync(p, textutil.sanitizeUtf8(n), { encoding: "utf-8" });
    allErr.push(...errs);
  }

  writeFileSync(
    join(docs, "notion-link-report.txt"),
    textutil.sanitizeUtf8(allErr.length > 0 ? `${allErr.join("\n")}\n` : "ok\n"),
    { encoding: "utf-8" },
  );
  writeFileSync(
    join(docs, "notion-import-manifest.json"),
    textutil.sanitizeUtf8(`${JSON.stringify(manifest, null, 2)}\n`),
    { encoding: "utf-8" },
  );

  const lc = linkCheck(outRoot);
  writeFileSync(
    join(docs, "notion-link-check.txt"),
    textutil.sanitizeUtf8(lc.length > 0 ? `${lc.join("\n")}\n` : "ok\n"),
    { encoding: "utf-8" },
  );
  if (lc.length > 0) {
    console.log("link_check issues:", lc.length);
    for (const x of lc.slice(0, 20)) console.log(" ", x);
  }

  if (tempdir) rmSync(tempdir, { recursive: true, force: true });
}
