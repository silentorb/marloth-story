import { stripLeadingTitleHeading } from "./markdown-body";

/** Normalize markdown for comparing editor output against the last saved body. */
export function normalizeEditorBody(body: string, title: string): string {
  return stripLeadingTitleHeading(body.replace(/\r\n/g, "\n"), title);
}

export function bodyNeedsSave(nextBody: string, savedBody: string | null, title: string): boolean {
  if (savedBody === null) return false;
  return normalizeEditorBody(nextBody, title) !== savedBody;
}

export function titleNeedsSave(nextTitle: string, savedTitle: string | null): boolean {
  const trimmed = nextTitle.trim() || "Untitled";
  return savedTitle !== null && trimmed !== savedTitle;
}
