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

const NOTION_ASIDE_RE = /<aside>\n?((?:(?!<aside>)[\s\S])*?)\n?<\/aside>/g;
const BLOCKQUOTED_ASIDE_RE = /^> <aside>\n((?:> .*\n)*?)^> <\/aside>/gm;
const LEADING_CALLOUT_EMOJI =
  /^[\p{Extended_Pictographic}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]+(?:\s+)?/u;

function isEmojiOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && stripEmojis(trimmed) === "";
}

/** Merge a leading emoji-only line with the next content line for inline callout layout. */
export function formatCalloutContentLines(lines: string[]): string[] {
  if (lines.length === 0) return lines;
  if (isEmojiOnlyLine(lines[0]!)) {
    let index = 1;
    while (index < lines.length && !lines[index]!.trim()) index += 1;
    if (index < lines.length) {
      return [`${lines[0]!.trim()} ${lines[index]!.trimStart()}`, ...lines.slice(index + 1)];
    }
    return [lines[0]!.trim()];
  }

  const match = LEADING_CALLOUT_EMOJI.exec(lines[0]!);
  if (!match) return lines;

  const emoji = match[0].trimEnd();
  const rest = lines[0]!.slice(match[0].length).trimStart();
  const out = rest ? [`${emoji} ${rest}`] : [emoji];
  out.push(...lines.slice(1));
  return out;
}

function parseBlockquoteLine(line: string): { depth: number; content: string } | null {
  const match = /^(>+)(?:\s(.*))?$/.exec(line);
  if (!match) return null;
  return { depth: match[1]!.length, content: match[2] ?? "" };
}

function formatBlockquoteLine(depth: number, content: string): string {
  const prefix = ">".repeat(depth);
  return content ? `${prefix} ${content}` : prefix;
}

function mergeCalloutBlockquoteEntries(
  entries: { depth: number; content: string }[],
): { depth: number; content: string }[] {
  const out: { depth: number; content: string }[] = [];
  let index = 0;
  while (index < entries.length) {
    const current = entries[index]!;
    if (current.content === "") {
      index += 1;
      continue;
    }
    if (isEmojiOnlyLine(current.content)) {
      let next = index + 1;
      while (next < entries.length && entries[next]!.content === "") next += 1;
      const follower = entries[next];
      if (follower && follower.depth === current.depth && follower.content) {
        out.push({
          depth: current.depth,
          content: `${current.content.trim()} ${follower.content.trimStart()}`,
        });
        index = next + 1;
        continue;
      }
    }
    out.push(current);
    index += 1;
  }
  return out;
}

function splitCalloutLine(content: string): string[] {
  if (isEmojiOnlyLine(content)) return [content.trim()];
  const match = LEADING_CALLOUT_EMOJI.exec(content);
  if (!match) return [content];
  const emoji = match[0].trimEnd();
  const rest = content.slice(match[0].length).trimStart();
  return rest ? [emoji, rest] : [emoji];
}

function normalizeBlockquoteRun(lines: string[]): string[] {
  const parsed = lines
    .map((line) => parseBlockquoteLine(line))
    .filter((line): line is { depth: number; content: string } => line !== null);
  if (parsed.length !== lines.length) return lines;

  const out: { depth: number; content: string }[] = [];
  for (const current of parsed) {
    if (isEmojiOnlyLine(current.content)) {
      out.push({ depth: current.depth, content: current.content.trim() });
      continue;
    }

    const pieces = splitCalloutLine(current.content);
    if (pieces.length === 1 && pieces[0] === current.content) {
      out.push(current);
      continue;
    }

    for (const piece of pieces) {
      out.push({ depth: current.depth, content: piece });
    }
  }

  return mergeCalloutBlockquoteEntries(out).map(({ depth, content }) =>
    formatBlockquoteLine(depth, content),
  );
}

/** Normalize stored blockquote callouts to inline emoji + text layout. */
export function normalizeCalloutBlockquotes(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]!.startsWith(">")) {
      out.push(lines[i]!);
      i += 1;
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j]!.startsWith(">")) j += 1;
    out.push(...normalizeBlockquoteRun(lines.slice(i, j)));
    i = j;
  }
  return out.join("\n");
}

function asideInnerToBlockquote(inner: string): string {
  const lines = inner.replace(/\r\n/g, "\n").split("\n");
  while (lines.length && !lines.at(-1)!.trim()) lines.pop();
  while (lines.length && !lines[0]!.trim()) lines.shift();
  const formatted = formatCalloutContentLines(lines);
  return formatted.map((line) => (line.trim() === "" ? ">" : `> ${line}`)).join("\n");
}

function unwrapBlockquotedAsides(body: string): string {
  return body.replace(BLOCKQUOTED_ASIDE_RE, (_, inner: string) => {
    const content = inner
      .split("\n")
      .map((line) => (line.startsWith("> ") ? line.slice(2) : line))
      .join("\n");
    return `<aside>\n${content}\n</aside>`;
  });
}

/** Convert Notion `<aside>` callouts to markdown blockquotes (Crepe quote blocks). */
export function convertNotionAsidesToBlockquotes(body: string): string {
  let out = body;
  for (;;) {
    const unwrapped = unwrapBlockquotedAsides(out);
    let next = unwrapped;
    for (;;) {
      const converted = next.replace(NOTION_ASIDE_RE, (_, inner: string) =>
        asideInnerToBlockquote(inner),
      );
      if (converted === next) break;
      next = converted;
    }
    if (next === out) break;
    out = next;
  }
  return normalizeCalloutBlockquotes(out);
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
