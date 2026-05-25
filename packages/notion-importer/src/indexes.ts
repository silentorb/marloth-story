import { readFileSync } from "node:fs";
import { disambiguateHeaders, stripEmojis } from "./textutil";

const ID_VIEW =
  /^(.+?)\s+([a-f0-9]{32})((?:_all(?:_[0-9]+)?)?)\.csv$/i;

export interface ParsedCsvBasename {
  displayName: string;
  databaseId: string;
  viewKey: string;
  fileStem: string;
}

export function parseCsvBasename(name: string): ParsedCsvBasename | null {
  const m = ID_VIEW.exec(name);
  if (!m) return null;
  const displayName = m[1]!;
  const dbid = m[2]!.toLowerCase();
  const suff = m[3] ?? "";
  let view: string;
  if (!suff) view = "default";
  else if (suff === "_all") view = "all";
  else {
    const m2 = /^_all_(\d+)$/.exec(suff);
    view = m2 ? `all-${m2[1]}` : suff.replace(/^_/, "") || "default";
  }
  return { displayName, databaseId: dbid, viewKey: view, fileStem: name };
}

export function indexOutFilename(databaseId: string, view: string): string {
  const vid = databaseId.toLowerCase();
  const v = view.toLowerCase().replace(/_/g, "-");
  return `index-${vid}-${v}.md`;
}

/** Minimal CSV reader matching Python csv.reader on Notion exports. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function readCsvRows(path: string): [string[], string[][]] {
  const text = readFileSync(path, { encoding: "utf-8" });
  const rows = parseCsv(text);
  if (rows.length === 0) return [[], []];
  let header = rows[0]!.map((h) => stripEmojis(h));
  header = disambiguateHeaders(header);
  return [header, rows.slice(1)];
}
