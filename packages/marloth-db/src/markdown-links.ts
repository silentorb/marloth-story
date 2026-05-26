const MARLOTH_LINK_SCHEME = "marloth:";
const NOTION_ID_IN_PATH = /([a-f0-9]{32})(?:\.(?:md|csv))?$/i;
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const NOTION_PAREN_LINK =
  /(?<!\[)([^\[\]\n(]+?)\s*\(\s*([^)]+?\.(?:md|csv))(?:#([^)]*))?\s*\)(?!\])/gi;

function normalizeRecordId(id: string): string {
  return id.toLowerCase();
}

/** Resolve a markdown href to a 32-hex record id, if it references a graph vertex. */
export function resolveMarkdownHrefTarget(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(MARLOTH_LINK_SCHEME)) {
    const id = trimmed.slice(MARLOTH_LINK_SCHEME.length).trim();
    return id ? normalizeRecordId(id) : null;
  }
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  ) {
    return null;
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    /* keep raw href */
  }

  const hashIdx = decoded.indexOf("#");
  const pathOnly = hashIdx >= 0 ? decoded.slice(0, hashIdx) : decoded;
  const match = NOTION_ID_IN_PATH.exec(pathOnly.trim());
  return match?.[1] ? normalizeRecordId(match[1]) : null;
}

export interface MarkdownLinkMatch {
  linkText: string;
}

/** Find inline markdown links in body text that resolve to targetId. */
export function findMarkdownLinksToTarget(
  body: string,
  targetId: string,
): MarkdownLinkMatch[] {
  const normalizedTarget = normalizeRecordId(targetId);
  const matches: MarkdownLinkMatch[] = [];

  MD_LINK.lastIndex = 0;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = MD_LINK.exec(body)) !== null) {
    const linkText = mdMatch[1] ?? "";
    const href = mdMatch[2] ?? "";
    if (resolveMarkdownHrefTarget(href) === normalizedTarget) {
      matches.push({ linkText });
    }
  }

  NOTION_PAREN_LINK.lastIndex = 0;
  let parenMatch: RegExpExecArray | null;
  while ((parenMatch = NOTION_PAREN_LINK.exec(body)) !== null) {
    const linkText = parenMatch[1]?.trim() ?? "";
    const pathPart = parenMatch[2]?.trim() ?? "";
    if (resolveMarkdownHrefTarget(pathPart) === normalizedTarget) {
      matches.push({ linkText });
    }
  }

  return matches;
}
