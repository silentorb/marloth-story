import type { RelationLink } from "../../shared/types";

export const RELATION_CELL_MAX_WIDTH_REM = 14;
export const RELATION_CELL_MAX_LINES = 6;
export const RELATION_CELL_FONT =
  '0.85rem ui-sans-serif, system-ui, sans-serif';

/** Matches `.marloth-database-cell-badge` horizontal padding (8px × 2). */
export const RELATION_CELL_BADGE_PADDING_X_PX = 16;
/** Gap between badges in the cell body flex layout. */
export const RELATION_CELL_BADGE_GAP_PX = 4;

export type MeasureTextWidth = (text: string) => number;

export interface RelationCellDisplayResult {
  text: string;
  visibleLinks: RelationLink[];
  visibleCount: number;
  overflowCount: number;
}

export interface FormatRelationCellDisplayOptions {
  maxWidthPx: number;
  maxLines: number;
  measureWidth: MeasureTextWidth;
  emptyPlaceholder?: string;
  badgePaddingPx?: number;
  badgeGapPx?: number;
}

/** Count wrapped lines for `text` at `maxWidthPx`. */
export function countWrappedLines(
  text: string,
  maxWidthPx: number,
  measureWidth: MeasureTextWidth,
): number {
  if (!text) return 1;
  const tokens = text.match(/\S+|\s+/g) ?? [text];
  let lines = 1;
  let lineWidth = 0;
  for (const token of tokens) {
    const tokenWidth = measureWidth(token);
    if (lineWidth > 0 && lineWidth + tokenWidth > maxWidthPx) {
      lines += 1;
      lineWidth = tokenWidth;
    } else {
      lineWidth += tokenWidth;
    }
  }
  return lines;
}

function badgeWidth(
  title: string,
  measureWidth: MeasureTextWidth,
  badgePaddingPx: number,
): number {
  return measureWidth(title) + badgePaddingPx;
}

function buildDisplayText(visible: RelationLink[], overflowCount: number): string {
  if (visible.length === 0 && overflowCount === 0) return "";
  const prefix = visible.map((link) => link.title).join(" ");
  if (overflowCount <= 0) return prefix;
  const suffix = `${overflowCount}+`;
  return prefix ? `${prefix} ${suffix}` : suffix;
}

/**
 * Pack relation links into visible badges: skip any title wider than the cell
 * (no ellipsis on individual entries), then fill up to `maxLines` of wrapped rows.
 */
export function packRelationCellVisibleLinks(
  links: RelationLink[],
  options: FormatRelationCellDisplayOptions,
): RelationLink[] {
  const badgePaddingPx = options.badgePaddingPx ?? RELATION_CELL_BADGE_PADDING_X_PX;
  const badgeGapPx = options.badgeGapPx ?? RELATION_CELL_BADGE_GAP_PX;
  const visible: RelationLink[] = [];
  let lines = 1;
  let lineWidth = 0;

  for (const link of links) {
    const width = badgeWidth(link.title, options.measureWidth, badgePaddingPx);
    if (width > options.maxWidthPx) {
      continue;
    }

    const gap = lineWidth > 0 ? badgeGapPx : 0;
    const need = gap + width;

    if (lineWidth + need <= options.maxWidthPx) {
      lineWidth += need;
      visible.push(link);
      continue;
    }

    if (lines < options.maxLines) {
      lines += 1;
      lineWidth = width;
      visible.push(link);
      continue;
    }

    break;
  }

  return visible;
}

/**
 * Format relation links for a compact table cell, appending `{n}+` when not all fit.
 */
export function formatRelationCellDisplay(
  links: RelationLink[],
  options: FormatRelationCellDisplayOptions,
): RelationCellDisplayResult {
  const emptyPlaceholder = options.emptyPlaceholder ?? "—";
  if (links.length === 0) {
    return {
      text: emptyPlaceholder,
      visibleLinks: [],
      visibleCount: 0,
      overflowCount: 0,
    };
  }

  const visibleLinks = packRelationCellVisibleLinks(links, options);
  const overflowCount = links.length - visibleLinks.length;
  const text = buildDisplayText(visibleLinks, overflowCount);

  return {
    text,
    visibleLinks,
    visibleCount: visibleLinks.length,
    overflowCount,
  };
}

let canvasMeasure: MeasureTextWidth | null = null;

/** Canvas-based width measure for browser UI (matches RELATION_CELL_FONT). */
export function createCanvasMeasureWidth(font = RELATION_CELL_FONT): MeasureTextWidth {
  return (text: string) => {
    if (!canvasMeasure) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return text.length * 8;
      ctx.font = font;
      canvasMeasure = (s) => ctx.measureText(s).width;
    }
    return canvasMeasure(text);
  };
}

/** Deterministic measure for unit tests (8px per character). */
export function fixedCharMeasureWidth(charWidth = 8): MeasureTextWidth {
  return (text: string) => text.length * charWidth;
}

export function relationCellMaxWidthPx(
  rootFontSizePx = 16,
  maxWidthRem = RELATION_CELL_MAX_WIDTH_REM,
): number {
  return maxWidthRem * rootFontSizePx;
}
