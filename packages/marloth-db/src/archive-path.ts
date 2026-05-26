export const ARCHIVE_NOTION_PATH_PREFIX = "Marloth/Archive";

export function isArchivedNotionPath(path: string | null): boolean {
  if (!path) return false;
  return (
    path === ARCHIVE_NOTION_PATH_PREFIX ||
    path.startsWith(`${ARCHIVE_NOTION_PATH_PREFIX}/`)
  );
}
