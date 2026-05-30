import type { RelationLink } from "../../shared/types";

export const RELATION_CELL_MAX_WIDTH_REM = 14;
export const RELATION_CELL_MAX_LINES = 6;
export const RELATION_CELL_FONT =
  '0.85rem ui-sans-serif, system-ui, sans-serif';

/** Matches `.marloth-database-cell-badge` horizontal padding (8px × 2). */
export const RELATION_CELL_BADGE_PADDING_X_PX = 16;

/** Reserved at the right of the cell for the hover edit control (see relation-cell-editor.css). */
export const RELATION_CELL_EDIT_GUTTER_PX = 26;

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
}

/** Text used when measuring how many lines a link occupies in the cell. */
export function relationCellLinkMeasureText(title: string): string {
  return title;
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

export function countRelationLinkLines(
  title: string,
  maxWidthPx: number,
  measureWidth: MeasureTextWidth,
): number {
  const contentMaxWidth = Math.max(1, maxWidthPx - RELATION_CELL_BADGE_PADDING_X_PX);
  return countWrappedLines(
    relationCellLinkMeasureText(title),
    contentMaxWidth,
    measureWidth,
  );
}

function buildDisplayText(visible: RelationLink[], overflowCount: number): string {
  if (visible.length === 0 && overflowCount === 0) return "";
  const prefix = visible.map((link) => relationCellLinkMeasureText(link.title)).join(" ");
  if (overflowCount <= 0) return prefix;
  const suffix = `${overflowCount}+`;
  return prefix ? `${prefix} ${suffix}` : suffix;
}

/**
 * Pack relation links by wrapped line budget; long titles wrap instead of being skipped.
 * Always keeps at least the first link when any exist.
 */
export function packRelationCellVisibleLinks(
  links: RelationLink[],
  options: FormatRelationCellDisplayOptions,
): RelationLink[] {
  const visible: RelationLink[] = [];
  let usedLines = 0;

  for (const link of links) {
    const linkLines = countRelationLinkLines(
      link.title,
      options.maxWidthPx,
      options.measureWidth,
    );

    if (visible.length === 0) {
      visible.push(link);
      usedLines = linkLines;
      continue;
    }

    if (usedLines + linkLines > options.maxLines) {
      break;
    }

    visible.push(link);
    usedLines += linkLines;
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
