# Session 02 — Editor workspace integration

## Purpose

Expose workspace configuration to the Tome editor webview and remove **duplicate** hardcoded Marloth node IDs from `tome-editor`. Archive/home/protected behavior must remain unchanged for the Marloth corpus.

## Depends on

[Session 01](./01-workspace-json.md) — `content/model/workspace.json` and `tome-db` workspace loader must exist.

## Implementation steps

### 1. API — `GET /api/workspace`

In [`packages/tome-editor/src/api/server.ts`](../../packages/tome-editor/src/api/server.ts):

```typescript
if (path === "/api/workspace") {
  return json(db.getWorkspace());
}
```

Add to [`EditorDatabase`](../../packages/tome-editor/src/api/database.ts):

```typescript
getWorkspace(): WorkspaceFile; // or a slim WorkspacePublic DTO
```

Implementation: `loadWorkspaceFromContent(contentPath)` from `tome-db`.

**Response shape:** Return the parsed workspace file (or a subset). Minimum fields needed by the webview:

- `homeNodeId`, `archiveNodeId`, `protectedNodeIds`
- `sidebar.links`
- `branding`
- `graphExplorer.defaultAnchorNodeId`

Optional enhancement: include `archiveNodeTitle` resolved from the graph (avoids extra round-trip for archive confirm dialog).

Keep existing `GET /api/home` — it may delegate to `workspace.homeNodeId` with the same fallback logic as today (node exists → home id; else recent → home id).

### 2. HTTP client

[`packages/tome-editor/src/shared/http-client.ts`](../../packages/tome-editor/src/shared/http-client.ts):

```typescript
getWorkspace(): Promise<WorkspaceFile>;
```

[`packages/tome-editor/src/webview/api/client.ts`](../../packages/tome-editor/src/webview/api/client.ts) — expose on the editor API object.

### 3. App boot — cache workspace

In [`packages/tome-editor/src/webview/App.tsx`](../../packages/tome-editor/src/webview/App.tsx):

- Fetch `getWorkspace()` on mount (parallel with `getHomeId()` is fine)
- Store in React state or a small context hook (`useWorkspace()`)
- Pass `protectedNodeIds` where delete/archive guards need them

### 4. Remove editor duplicates

| File | Action |
| --- | --- |
| [`shared/types.ts`](../../packages/tome-editor/src/shared/types.ts) | Remove or deprecate `HOME_NODE_ID`, `ARCHIVE_NODE_ID`; change `isProtectedEditorNode(id, protectedIds)` to accept ids from workspace |
| [`shared/graph-explorer.ts`](../../packages/tome-editor/src/shared/graph-explorer.ts) | Remove duplicate `DEFAULT_GRAPH_EXPLORER_ANCHOR_ID`; read anchor from workspace state or import single export from `tome-db` after session 01 |
| [`webview/node-links.ts`](../../packages/tome-editor/src/webview/node-links.ts) | `resolveGraphExplorerAnchor` uses workspace default when no URL anchor |

Update all test imports of `HOME_NODE_ID` to use fixture workspace values or test constants.

### 5. Sidebar navigation

Replace hardcoded array in [`sidebar-nav.ts`](../../packages/tome-editor/src/webview/sidebar-nav.ts):

**Before:** `SIDEBAR_NODE_LINKS` constant with seven Marloth database ids.

**After:**

- Keep `HOME_ICON`, `VIEW_ICONS`, and `SidebarNodeLink` type
- Export helpers:
  - `buildSidebarIconMaps(links: SidebarLink[]): { byNodeId, byLabel }`
  - Default empty maps when links missing
- [`SidePanel.tsx`](../../packages/tome-editor/src/webview/components/SidePanel.tsx) maps `workspace.sidebar.links` → `NavItem` list (field rename: `nodeId` → component `id` prop)

Remove `SIDEBAR_NODE_LINKS` export once all callers use workspace data.

### 6. Document icon

[`document-icon.ts`](../../packages/tome-editor/src/webview/document-icon.ts):

- Accept `defaultDocumentIcon` from workspace branding (fallback `"M"`)
- Build `SIDEBAR_ICON_BY_*` from workspace links passed in `DocumentIconContext` instead of module-level constants

### 7. Archive UX copy

[`PageActionsMenu.tsx`](../../packages/tome-editor/src/webview/components/PageActionsMenu.tsx):

- Replace hardcoded `"Archive"` in confirm message with archive hub **title** when available
- Prop: `archiveHubTitle?: string` from workspace API enrichment or node fetch

Example message: `Archive "${displayTitle}"? It will be moved under ${archiveHubTitle} and hidden from most views.`

### 8. Tests

| Test file | Update |
| --- | --- |
| New `workspace-api.test.ts` | `GET /api/workspace` returns seeded fixture |
| [`SidePanel.test.tsx`](../../packages/tome-editor/tests/webview/components/SidePanel.test.tsx) | Pass mock workspace links |
| [`document-icon.test.ts`](../../packages/tome-editor/tests/webview/document-icon.test.ts) | Use workspace branding + links |
| [`node-lifecycle-api.test.ts`](../../packages/tome-editor/tests/api/node-lifecycle-api.test.ts) | Seed `workspace.json` in fixture |
| [`shared/types.test.ts`](../../packages/tome-editor/tests/shared/types.test.ts) | Remove reliance on `HOME_NODE_ID` if deleted |

Ensure test API setup ([`test-api-setup.ts`](../../packages/tome-editor/tests/api/test-api-setup.ts)) writes default `workspace.json` into test content dirs.

### 9. Documentation fixes

**[`docs/features/tome-editor.md`](../features/tome-editor.md)**

- Fix home node id: `13458e628ba28073850dea0edb9acde1` (not `72b6fb45…`)
- Document `GET /api/workspace` and `content/model/workspace.json`
- Note sidebar links come from workspace config

**[`docs/features/tome-db.md`](../features/tome-db.md)**

- Confirm workspace.json row added in session 01

## Done when

- [ ] Editor loads sidebar from `/api/workspace`, not hardcoded `sidebar-nav.ts` ids
- [ ] No `HOME_NODE_ID` / `ARCHIVE_NODE_ID` in `tome-editor/src` (except deprecated shims with `@deprecated`, if any)
- [ ] Graph Explorer default anchor comes from workspace
- [ ] `bun run --filter tome-editor test` passes
- [ ] Feature doc home id corrected

## Manual smoke test

1. `bun run editor:dev`
2. Sidebar shows Features, Scenes, … in configured order
3. Home navigates to TWOLD design home page
4. Archive on a test page still works; protected nodes (home/archive) cannot be deleted
