import { hasLeadingCalloutEmoji } from "marloth-db/callout";

/** Add `marloth-callout` to blockquotes whose first paragraph starts with a callout emoji. */
export function decorateCalloutHtml(html: string): string {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (full, inner) => {
    const firstParagraph = /<p>([^<]*)<\/p>/i.exec(inner);
    if (!firstParagraph || !hasLeadingCalloutEmoji(firstParagraph[1]!)) return full;
    return `<blockquote class="marloth-callout">${inner}</blockquote>`;
  });
}
