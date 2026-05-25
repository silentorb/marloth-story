import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { GraphDatabase, IS_A_LABEL } from "marloth-db";
import { findExportFiles, readExportText } from "./export-fs";
import { extractNotionId } from "./ids";
import * as indexes from "./indexes";
import { splitNotionPage } from "./parse";
import { normalizeRelationLabel, parseRelationLinks } from "./relations";
import * as textutil from "./textutil";

const PROP_LINE = /^(.{1,200}?):\s+(.*)\s*$/;

function isRelationValue(val: string): boolean {
  const v = val.trim();
  if (v.includes("(") && (v.includes(".md") || v.includes(".csv"))) return true;
  if (v.includes("(/") && (v.includes(".md") || v.includes(".csv"))) return true;
  return false;
}

function isPropertyLine(line: string): boolean {
  if (!line || line.trimStart().startsWith("#")) return false;
  const m = PROP_LINE.exec(line);
  if (!m) return false;
  if (m[1]!.includes(":")) return false;
  return true;
}

function splitRelationsFromBody(lines: string[]): {
  relations: [string, string][];
  bodyLines: string[];
} {
  const relations: [string, string][] = [];
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (isPropertyLine(line)) {
      const m = PROP_LINE.exec(line)!;
      const key = m[1]!;
      const val = m[2]!;
      if (isRelationValue(val)) relations.push([key, val]);
      else bodyLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }
  return { relations, bodyLines };
}

function primaryAlias(title: string, notionId: string): string {
  const t = title.trim();
  const suff = ` ${notionId}`;
  if (t.toLowerCase().endsWith(suff.toLowerCase())) return t.slice(0, -suff.length);
  const m = / ([a-f0-9]{32})$/i.exec(t);
  if (m && m[1]!.toLowerCase() === notionId) return t.slice(0, m.index);
  return t;
}

function inferredNotionPath(sourceReposix: string): string | undefined {
  const relative = exportRelativePath(sourceReposix);
  if (!relative) return undefined;
  const dir = dirname(relative);
  return dir === "." ? undefined : dir;
}

function exportRelativePath(sourceReposix: string): string | null {
  if (sourceReposix.startsWith("exports/")) {
    const rest = sourceReposix.slice("exports/".length);
    const slash = rest.indexOf("/");
    return slash >= 0 ? rest.slice(slash + 1) : null;
  }
  // Legacy paths in older graph imports (before ./exports/ was canonical).
  if (sourceReposix.startsWith("external/notion/")) {
    return sourceReposix.slice("external/notion/".length);
  }
  return null;
}

export interface GraphRunOptions {
  repoRoot: string;
  clean?: boolean;
  source?: string;
  dbPath?: string;
}

export interface GraphManifestEntry {
  notion_id: string;
  source_export: string;
  inferred_notion_path?: string;
  labels: string[];
}

export interface GraphManifest {
  version: number;
  database: string;
  vertices: Record<string, GraphManifestEntry>;
  databases: Record<string, { notion_database: string; source_export: string; view: string }>;
  counts: { vertices: number; edges: number };
}

interface PagePlan {
  notionId: string;
  sourceReposix: string;
  relations: [string, string][];
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
    const zips = findExportFiles(root, (p) => p.endsWith(".zip"));
    if (zips.length === 0) return;
    zips.sort((a, b) => b.split("/").length - a.split("/").length);
    for (const zpath of zips) {
      await runUnzip(zpath, dirname(zpath));
      unlinkSync(zpath);
    }
  }
  throw new Error(`nested zip extraction exceeded ${maxRounds} rounds`);
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
  throw new Error(
    "No Notion export found. Add a .zip or directory under ./exports/ or set NOTION_EXPORT_DIR.",
  );
}

function relationLabel(rawKey: string): string {
  return textutil.slugifyKey(textutil.stripEmojis(rawKey)).toUpperCase().replace(/-/g, "_");
}

function ensurePageVertex(
  db: GraphDatabase,
  notionId: string,
  title: string,
  extra: Record<string, string | undefined> = {},
): void {
  const existing = db.getVertex(notionId);
  const props: Record<string, string> = {};
  const hasFullPage = typeof existing?.properties.source_export === "string";
  if (!hasFullPage) {
    props.title = normalizeRelationLabel(title);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) props[k] = v;
  }
  db.upsertVertex(notionId, ["NotionPage"], props);
}

function plainNameFromCell(nameVal: string, nameLinks: ReturnType<typeof parseRelationLinks>): string {
  const trimmed = nameVal.trim();
  if (!trimmed) return "";
  if (nameLinks[0]?.label) return nameLinks[0].label.trim();
  return trimmed;
}

function normalizeTitleForMatch(title: string): string {
  return normalizeRelationLabel(title);
}

function resolvePageIdByTitle(db: GraphDatabase, title: string): string | null {
  const trimmed = normalizeTitleForMatch(title);
  if (!trimmed) return null;
  const pattern = trimmed.replace(/[%_\\]/g, "\\$&");
  const rows = db.searchVerticesByTitle(pattern, 20);
  const exact = rows.filter(
    (row) =>
      normalizeTitleForMatch(row.title).localeCompare(trimmed, undefined, {
        sensitivity: "base",
      }) === 0,
  );
  if (exact.length === 0) return null;
  exact.sort((a, b) => {
    const aScore = a.path ? 1 : 0;
    const bScore = b.path ? 1 : 0;
    return bScore - aScore;
  });
  return exact[0]!.id;
}

function importMarkdownPage(
  db: GraphDatabase,
  absMd: string,
  sourceReposix: string,
  exportRoot: string,
): PagePlan {
  const text = readExportText(absMd, exportRoot);
  const sp = splitNotionPage(text);
  const notionId = extractNotionId(basename(absMd));
  if (!notionId) throw new Error(`no notion id in ${absMd}`);

  const { relations, bodyLines } = splitRelationsFromBody(sp.bodyLines);
  let body = bodyLines.join("\n").trim();
  if (body) body = `${sp.h1}\n\n${body}`;
  else body = sp.h1;
  body = textutil.convertNotionAsidesToBlockquotes(body);

  const properties: Record<string, string> = {
    title: sp.h1Text,
    notion_id: notionId,
    source_export: sourceReposix,
    body,
    alias: primaryAlias(sp.h1Text, notionId),
  };
  const inferred = inferredNotionPath(sourceReposix);
  if (inferred) properties.inferred_notion_path = inferred;

  for (const [rawK, val] of sp.scalarProperties) {
    let key = textutil.slugifyKey(textutil.stripEmojis(rawK));
    if (key in properties) key = `prop_${key}`;
    properties[key] = val;
  }

  db.upsertVertex(notionId, ["NotionPage"], properties);
  return { notionId, sourceReposix, relations };
}

function importRelations(
  db: GraphDatabase,
  plans: PagePlan[],
  unresolved: string[],
): void {
  for (const plan of plans) {
    for (const [rawKey, val] of plan.relations) {
      const label = relationLabel(rawKey);
      const links = parseRelationLinks(val);
      links.forEach((link, ordinal) => {
        if (!link.notionId) {
          unresolved.push(`unresolved: ${link.path} on ${plan.notionId} (${rawKey})`);
          return;
        }
        ensurePageVertex(db, link.notionId, link.label);
        db.upsertEdge(plan.notionId, link.notionId, label, { ordinal });
      });
    }
  }
}

function orphanPageId(databaseId: string, viewKey: string, rowIndex: number): string {
  return createHash("sha256")
    .update(`${databaseId}\0${viewKey}\0${rowIndex}`)
    .digest("hex")
    .slice(0, 32);
}

function importCsvFile(
  db: GraphDatabase,
  csvPath: string,
  sourceReposix: string,
  unresolved: string[],
  exportRoot: string,
): { databaseId: string; view: string } | null {
  const parsed = indexes.parseCsvBasename(basename(csvPath));
  if (!parsed) return null;

  const databaseId = parsed.databaseId;
  db.upsertVertex(databaseId, ["NotionDatabase"], {
    title: parsed.displayName,
    notion_database: databaseId,
    source_export: sourceReposix,
  });

  const [headers, rows] = indexes.readCsvRows(csvPath, exportRoot);
  if (headers.length === 0) return { databaseId, view: parsed.viewKey };

  const nameCol = headers.find((h) => h.toLowerCase() === "name") ?? headers[0]!;

  rows.forEach((row, rowIndex) => {
    const cells = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""]));
    const nameVal = cells[nameCol] ?? "";
    const nameLinks = parseRelationLinks(nameVal);
    const rowName = plainNameFromCell(nameVal, nameLinks);
    let pageId = nameLinks[0]?.notionId ?? null;
    if (!pageId && rowName) {
      pageId = resolvePageIdByTitle(db, rowName);
    }

    const rowScalars: Record<string, string> = {};
    for (const [col, val] of Object.entries(cells)) {
      if (!val.trim()) continue;
      if (col === nameCol) continue;
      if (isRelationValue(val)) continue;
      rowScalars[textutil.slugifyKey(col)] = val.trim();
    }

    const rowProperties: Record<string, string | number> = {
      view: parsed.viewKey,
      row_index: rowIndex,
      ...rowScalars,
    };

    const targetPageId = pageId;
    if (targetPageId) {
      ensurePageVertex(db, targetPageId, (nameLinks[0]?.label ?? rowName) || targetPageId);
      db.upsertEdge(targetPageId, databaseId, IS_A_LABEL, rowProperties);
    } else if (rowName || Object.keys(rowScalars).length > 0) {
      const orphanId = orphanPageId(databaseId, parsed.viewKey, rowIndex);
      ensurePageVertex(db, orphanId, rowName || orphanId, { orphan_row: "true" });
      db.upsertEdge(orphanId, databaseId, IS_A_LABEL, rowProperties);
    }

    for (const [col, val] of Object.entries(cells)) {
      if (!val.trim() || col === nameCol) continue;
      if (!isRelationValue(val)) continue;
      if (!targetPageId) continue;
      const label = relationLabel(col);
      const links = parseRelationLinks(val);
      links.forEach((link, ordinal) => {
        if (!link.notionId) {
          unresolved.push(`unresolved csv: ${link.path} in ${sourceReposix} row ${rowIndex}`);
          return;
        }
        ensurePageVertex(db, link.notionId, link.label);
        db.upsertEdge(targetPageId, link.notionId, label, {
          ordinal,
          via_database: databaseId,
          via_view: parsed.viewKey,
        });
      });
    }
  });

  return { databaseId, view: parsed.viewKey };
}

export async function runGraphImport(opts: GraphRunOptions): Promise<void> {
  const repoRoot = resolve(opts.repoRoot);
  const srcPath = resolveSourcePath(repoRoot, opts.source);
  const dbFile = resolve(opts.dbPath ?? join(repoRoot, "data", "marloth.sqlite"));
  const docs = resolve(repoRoot, "docs");

  let tempdir: string | null = null;
  let external: string;
  if (statSync(srcPath).isFile() && srcPath.toLowerCase().endsWith(".zip")) {
    [external, tempdir] = await extractExportArchive(srcPath);
  } else {
    external = resolve(srcPath);
  }

  if (!statSync(external).isDirectory()) {
    throw new Error(`missing ${external}`);
  }

  mkdirSync(docs, { recursive: true });

  const db = new GraphDatabase(dbFile, { clean: opts.clean });
  db.setMeta("import_source", relative(repoRoot, external) || external);
  db.setMeta("imported_at", new Date().toISOString());

  const mdFiles = findExportFiles(external, (p) => p.endsWith(".md"));
  const externalResolved = resolve(external);
  const repoResolved = resolve(repoRoot);
  let sourceLabel: string;
  const relExternal = relative(repoResolved, externalResolved);
  if (relExternal && !relExternal.startsWith("..")) {
    sourceLabel = relExternal.split("\\").join("/");
  } else if (basename(dirname(srcPath)) === "exports") {
    sourceLabel = `exports/${basename(srcPath)}`;
  } else {
    sourceLabel = basename(srcPath);
  }

  const manifest: GraphManifest = {
    version: 2,
    database: relative(repoRoot, dbFile).split("\\").join("/"),
    vertices: {},
    databases: {},
    counts: { vertices: 0, edges: 0 },
  };

  const pagePlans: PagePlan[] = [];
  for (const absMd of mdFiles) {
    const relposix = makeReposix(absMd, repoRoot, external, sourceLabel);
    const plan = importMarkdownPage(db, absMd, relposix, external);
    pagePlans.push(plan);
    manifest.vertices[plan.notionId] = {
      notion_id: plan.notionId,
      source_export: relposix,
      inferred_notion_path: inferredNotionPath(relposix),
      labels: ["NotionPage"],
    };
  }

  const unresolved: string[] = [];
  importRelations(db, pagePlans, unresolved);

  const csvFiles = findExportFiles(external, (p) => p.endsWith(".csv"));
  for (const csvPath of csvFiles) {
    const relposix = makeReposix(csvPath, repoRoot, external, sourceLabel);
    const info = importCsvFile(db, csvPath, relposix, unresolved, external);
    if (info) {
      manifest.databases[`${info.databaseId}:${info.view}`] = {
        notion_database: info.databaseId,
        source_export: relposix,
        view: info.view,
      };
    }
  }

  manifest.counts = db.counts();
  db.setMeta("manifest", JSON.stringify(manifest));

  writeFileSync(
    join(docs, "notion-link-report.txt"),
    textutil.sanitizeUtf8(unresolved.length > 0 ? `${unresolved.join("\n")}\n` : "ok\n"),
    { encoding: "utf-8" },
  );
  writeFileSync(
    join(docs, "notion-import-manifest.json"),
    textutil.sanitizeUtf8(`${JSON.stringify(manifest, null, 2)}\n`),
    { encoding: "utf-8" },
  );

  db.finalize();
  db.close();

  if (tempdir) rmSync(tempdir, { recursive: true, force: true });

  console.log(
    `imported ${manifest.counts.vertices} vertices, ${manifest.counts.edges} edges → ${manifest.database}`,
  );
  if (unresolved.length > 0) {
    console.log("unresolved relations:", unresolved.length);
  }
}
