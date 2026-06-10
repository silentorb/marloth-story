export function escapeCell(s: string): string {
  return s.replace(/\n/g, " ").replace(/\r/g, " ").replace(/\|/g, "\\|");
}

export function gfmTable(headers: string[], rows: string[][]): string {
  const w = headers.length;
  if (w === 0) return "";
  const lines = [
    `| ${headers.map((c) => escapeCell(c)).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const r of rows) {
    const rr = Array.from({ length: w }, (_, i) => (i < r.length ? r[i]! : ""));
    lines.push(`| ${rr.map((c) => escapeCell(c)).join(" | ")} |`);
  }
  return `${lines.join("\n")}\n`;
}
