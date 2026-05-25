/** True when markdown adds nothing beyond the record title (e.g. imported `# Title` only). */
export function isEffectivelyEmptyMarkdown(body: string, title: string): boolean {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return true;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;

  if (lines.length === 1) {
    const match = /^#+\s+(.*)$/.exec(lines[0]!);
    if (match && match[1]!.trim() === title.trim()) return true;
  }

  return false;
}
