/** Emoji stripping and YAML-safe key slugs. */

import { basename } from "node:path";
import { extractNotionId } from "./ids";

const EMOJI_OR_SYMBOL =
  /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E0}-\u{1F1FF}\u{200D}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{E000}-\u{F8FF}]+/gu;

const WS_RE = /\s+/g;
const KEY_SAFE = /[^a-z0-9_]+/g;

const RESERVED = new Set([
  "title",
  "notion_id",
  "aliases",
  "source_export",
  "notion_database",
  "notion_url",
  "tags",
  "type",
  "view",
]);

const APOS = "'\u2018\u2019\u201B\u02BC";

export function sanitizeUtf8(s: string): string {
  const buf = Buffer.from(s, "utf8");
  return buf.toString("utf8");
}

export function stripEmojis(s: string): string {
  let out = s.replace(EMOJI_OR_SYMBOL, "");
  out = out.replace(/\u200d/g, "").replace(/\ufe0f/g, "");
  out = out.replace(WS_RE, " ").trim();
  return out;
}

export function slugifyKey(label: string): string {
  let s = stripEmojis(label);
  s = s.trim().toLowerCase();
  s = s.replace(KEY_SAFE, "_");
  s = s.replace(/^_+|_+$/g, "");
  while (s.includes("__")) s = s.replace(/__/g, "_");
  if (!s) s = "property";
  if (RESERVED.has(s) || /^\d/.test(s)) s = `prop_${s}`;
  return s;
}

function stripCombining(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function urlFriendlyBasename(exportBasename: string): string {
  const nid = extractNotionId(exportBasename);
  if (!nid) throw new Error(`no notion id in filename: ${exportBasename}`);
  if (!exportBasename.toLowerCase().endsWith(".md")) {
    throw new Error(`expected .md: ${exportBasename}`);
  }
  const stem = basename(exportBasename, ".md");
  const suff = ` ${nid}`;
  if (!stem.toLowerCase().endsWith(suff.toLowerCase())) {
    throw new Error(`title segment before id not found in ${exportBasename}`);
  }
  let title = stem.slice(0, -suff.length);
  for (const ch of APOS) title = title.replaceAll(ch, "");
  title = stripCombining(title);
  title = title.toLowerCase();
  title = title.trim().replace(/\s+/g, "-");
  title = title.replace(/[^a-z0-9-]+/g, "-");
  title = title.replace(/-+/g, "-").replace(/^-|-$/g, "");
  const slug = title || "page";
  return `${slug}-${nid}.md`;
}

export function disambiguateHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const h of headers) {
    const base = stripEmojis(h) || "column";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push(n === 1 ? base : `${base}_${n}`);
  }
  return out;
}
