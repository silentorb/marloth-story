/**
 * Maps Notion database property names to graph edge labels for relation columns.
 * Parity with legacy CSV import rules (see docs/features/notion-import.md); not imported from notion-importer.
 */

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

export function stripEmojis(s: string): string {
  let out = s.replace(EMOJI_OR_SYMBOL, "");
  out = out.replace(/\u200d/g, "").replace(/\ufe0f/g, "");
  out = out.replace(WS_RE, " ").trim();
  return out;
}

function slugifyPropertySlug(label: string): string {
  let s = stripEmojis(label);
  s = s.trim().toLowerCase();
  s = s.replace(KEY_SAFE, "_");
  s = s.replace(/^_+|_+$/g, "");
  while (s.includes("__")) s = s.replace(/__/g, "_");
  if (!s) s = "property";
  if (RESERVED.has(s) || /^\d/.test(s)) s = `prop_${s}`;
  return s;
}

/** Graph edge label for a Notion relation property (e.g. "Bible passages" → "BIBLE_PASSAGES"). */
export function relationLabel(propertyName: string): string {
  return slugifyPropertySlug(propertyName).toUpperCase().replace(/-/g, "_");
}
