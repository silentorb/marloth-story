import type { AppView } from "../shared/types";

const APP_TITLE = "Marloth";

export function formatDocumentTitle(view: AppView, recordTitle?: string | null): string {
  if (view === "graph-overview") return `Graph Overview · ${APP_TITLE}`;
  if (view === "graph-explorer") return `Graph Explorer · ${APP_TITLE}`;
  if (recordTitle) {
    return recordTitle === APP_TITLE ? APP_TITLE : `${recordTitle} · ${APP_TITLE}`;
  }
  return APP_TITLE;
}

export function syncDocumentTitle(view: AppView, recordTitle?: string | null): void {
  document.title = formatDocumentTitle(view, recordTitle);
}
