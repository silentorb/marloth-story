/** Notion uses 32-char hex ids in exported filenames: "Page title abc123def4....md" */
const NOTION_32 = / ([a-f0-9]{32})\.(md|csv)(?:#.*)?$/i;

export function extractNotionId(filename: string): string | null {
  const m = NOTION_32.exec(filename);
  if (m) return m[1]!.toLowerCase();
  return null;
}
