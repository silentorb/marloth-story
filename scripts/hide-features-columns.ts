/**
 * Legacy script — per-tab column visibility lived in notion_views, which was
 * migrated to content/views.json (sorts only; all schema columns visible).
 *
 * To hide deprecated Features columns, edit notion_schema or use dynamic-fields
 * column sets instead. This script is retained as a no-op pointer.
 *
 * Usage: bun run scripts/hide-features-columns.ts
 */
console.log(
  "Obsolete: notion_views was removed. Column visibility is no longer per-tab; see docs/features/views.md.",
);
process.exit(0);
