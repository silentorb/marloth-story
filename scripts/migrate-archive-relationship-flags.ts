/**
 * One-time migration: flag incident relationships as archived for existing archive members.
 *
 * Usage: bun scripts/migrate-archive-relationship-flags.ts
 */
import {
  listArchiveMemberIdsFromStore,
  markIncidentRelationshipsArchived,
} from "tome-db";
import {
  defaultDbPathForContent,
  openTomeWriteContext,
  resolveContentPath,
} from "tome-db/content";

export function migrateArchiveRelationshipFlags(contentDir: string): {
  archiveMembers: number;
  relationshipsMarked: number;
} {
  const ctx = openTomeWriteContext(contentDir, defaultDbPathForContent(contentDir));
  const memberIds = listArchiveMemberIdsFromStore(ctx.store);
  let relationshipsMarked = 0;

  for (const memberId of memberIds) {
    relationshipsMarked += markIncidentRelationshipsArchived(ctx.store, memberId);
  }

  ctx.sync.syncRelationships();
  ctx.db.close();

  return {
    archiveMembers: memberIds.length,
    relationshipsMarked,
  };
}

if (import.meta.main) {
  const contentDir = resolveContentPath();
  const result = migrateArchiveRelationshipFlags(contentDir);
  console.log(JSON.stringify(result, null, 2));
}
