const PROPERTY_LINE = /^(.{1,200}?):\s+(.*)\s*$/;

export interface SplitPage {
  h1: string;
  h1Text: string;
  scalarProperties: [string, string][];
  bodyLines: string[];
}

function isRelationValue(val: string): boolean {
  const v = val.trim();
  if (v.includes("(") && (v.includes(".md") || v.includes(".csv"))) return true;
  if (v.includes("(/") && (v.includes(".md") || v.includes(".csv"))) return true;
  return false;
}

function isPropertyLine(line: string): boolean {
  if (!line || line.trimStart().startsWith("#")) return false;
  const m = PROPERTY_LINE.exec(line);
  if (!m) return false;
  if (m[1]!.includes(":")) return false;
  return true;
}

export function splitNotionPage(text: string): SplitPage {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.length === 0) {
    return {
      h1: "# Untitled",
      h1Text: "Untitled",
      scalarProperties: [],
      bodyLines: [],
    };
  }

  const h1 = lines[0]!;
  let h1Text = h1;
  const hm = /^#\s+(.*)$/.exec(h1);
  if (hm) h1Text = hm[1]!.trim();

  let i = 1;
  while (i < lines.length && !lines[i]!.trim()) i += 1;

  const scalars: [string, string][] = [];
  const relationAndRest: string[] = [];

  if (i < lines.length && isPropertyLine(lines[i]!)) {
    while (i < lines.length) {
      const line = lines[i]!;
      if (!line.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j]!.trim()) j += 1;
        if (j < lines.length && isPropertyLine(lines[j]!)) {
          i = j;
          continue;
        }
        break;
      }
      if (!isPropertyLine(line)) break;
      const m = PROPERTY_LINE.exec(line)!;
      const key = m[1]!;
      const val = m[2]!;
      if (isRelationValue(val)) relationAndRest.push(line);
      else scalars.push([key, val]);
      i += 1;
    }
  }

  relationAndRest.push(...lines.slice(i));
  return {
    h1,
    h1Text,
    scalarProperties: scalars,
    bodyLines: relationAndRest,
  };
}
