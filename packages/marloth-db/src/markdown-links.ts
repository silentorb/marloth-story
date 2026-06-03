const MARLOTH_LINK_SCHEME = "marloth:";
const NOTION_ID_IN_PATH = /([a-f0-9]{32})(?:\.(?:md|csv))?$/i;
const NODE_ID_PATTERN = /^[a-f0-9]{32}$/i;
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const NOTION_PAREN_LINK =
  /(?<!\[)([^\[\]\n(]+?)\s*\(\s*([^)]+?\.(?:md|csv))(?:#([^)]*))?\s*\)(?!\])/gi;

function normalizeRecordId(id: string): string {
  return id.toLowerCase();
}

function nodeIdFromQueryParam(value: string | null): string | null {
  if (!value || !NODE_ID_PATTERN.test(value)) return null;
  return normalizeRecordId(value);
}

function resolveNodeIdFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    return (
      nodeIdFromQueryParam(url.searchParams.get("node")) ??
      nodeIdFromQueryParam(url.searchParams.get("record"))
    );
  } catch {
    return null;
  }
}

function resolveNodeIdFromQueryOnlyHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith("?")) return null;
  const params = new URLSearchParams(trimmed);
  return (
    nodeIdFromQueryParam(params.get("node")) ?? nodeIdFromQueryParam(params.get("record"))
  );
}

/** Canonical relative href for a node markdown file in `content/data/`. */
export function canonicalNodeMarkdownHref(nodeId: string): string {
  return `./${normalizeRecordId(nodeId)}.md`;
}

/** Resolve a markdown href to a 32-hex record id, if it references a graph node. */
export function resolveMarkdownHrefTarget(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(MARLOTH_LINK_SCHEME)) {
    const id = trimmed.slice(MARLOTH_LINK_SCHEME.length).trim();
    return id && NODE_ID_PATTERN.test(id) ? normalizeRecordId(id) : null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return resolveNodeIdFromUrl(trimmed);
  }

  if (trimmed.startsWith("#") || trimmed.startsWith("mailto:")) {
    return null;
  }

  const fromQuery = resolveNodeIdFromQueryOnlyHref(trimmed);
  if (fromQuery) return fromQuery;

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

/** Rewrite resolvable node links in markdown bodies to `./{nodeId}.md`. */
export function canonicalizeMarkdownBodyLinks(body: string): string {
  return body.replace(MD_LINK, (match, text: string, href: string) => {
    const targetId = resolveMarkdownHrefTarget(href);
    if (!targetId) return match;
    const canonical = canonicalNodeMarkdownHref(targetId);
    if (href.trim() === canonical) return match;
    return `[${text}](${canonical})`;
  });
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
