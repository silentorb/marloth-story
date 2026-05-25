import { extractNotionId } from "./ids";

const NOTION_PAREN_LINK =
  /(?<!\[)([^\[\]\n(]+?)\s*\(\s*([^)]+?\.(?:md|csv))(?:#([^)]*))?\s*\)(?!\])/gi;

const ID_IN_TEXT = /([a-f0-9]{32})(?:\.(?:md|csv))?/i;

export interface ParsedLink {
  label: string;
  path: string;
  notionId: string | null;
}

export function extractNotionIdFromText(text: string): string | null {
  const m = ID_IN_TEXT.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

/** Parse Notion `Label (path.md)` / `Label (path.csv)` relation lists. */
export function parseRelationLinks(value: string): ParsedLink[] {
  const out: ParsedLink[] = [];
  const re = new RegExp(NOTION_PAREN_LINK.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const pathPart = m[2]!.trim();
    let decoded = pathPart;
    try {
      decoded = decodeURIComponent(pathPart);
    } catch {
      /* keep raw path */
    }
    const pathBasename = decoded.split("/").pop() ?? decoded;
    const notionId =
      extractNotionId(pathBasename) ?? extractNotionIdFromText(decoded);
    out.push({
      label: m[1]!.trim(),
      path: pathPart,
      notionId,
    });
  }
  return out;
}
