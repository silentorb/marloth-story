function quote(s: string): string {
  return JSON.stringify(s);
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "null";
    return Number.isInteger(v) ? String(v) : String(v);
  }
  if (typeof v === "string") return quote(v);
  return quote(String(v));
}

/** Emit YAML front matter without a YAML library: shallow dict, flat lists, scalars. */
export function formatFrontMatter(data: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) {
        lines.push(`  - ${quote(String(item))}`);
      }
    } else {
      lines.push(`${k}: ${scalar(v)}`);
    }
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}
