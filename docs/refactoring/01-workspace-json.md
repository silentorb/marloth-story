# Session 01 — `workspace.json` and backend wiring

## Purpose

Introduce [`content/model/workspace.json`](../../content/model/workspace.json) and wire **all backend consumers** off hardcoded Marloth node IDs. Do **not** change editor UI or add API routes in this session (that is [session 02](./02-editor-workspace-integration.md)).

## Depends on

None — start here after reading [00-overview.md](./00-overview.md).

## Target schema (v1)

Create `content/model/workspace.json` with Marloth corpus values:

```json
{
  "version": 1,
  "homeNodeId": "13458e628ba28073850dea0edb9acde1",
  "archiveNodeId": "0f558a609a56485185beed4d1fd1cd9f",
  "protectedNodeIds": [
    "13458e628ba28073850dea0edb9acde1",
    "0f558a609a56485185beed4d1fd1cd9f"
  ],
  "graphExplorer": {
    "defaultAnchorNodeId": "e028aa0786f5449984a4f497c1d746fa"
  },
  "staticSite": {
    "homeNodeId": "5bfc10918fa24207879d68a030927dd3"
  },
  "sidebar": {
    "links": [
      { "nodeId": "dd0de9867cc345b898929306bdf9fc83", "label": "Features", "icon": "★" },
      { "nodeId": "528384943746443a9c89699b57e3bbec", "label": "Solutions", "icon": "✓" },
      { "nodeId": "204dba198db74611b0b49a98dd53e8f5", "label": "Scenes", "icon": "▶" },
      { "nodeId": "2eea538996934ce8abafc27132e576c1", "label": "Inspirations", "icon": "✦" },
      { "nodeId": "5a585a2a311c4768be4a81f27bdcdfb4", "label": "Articles", "icon": "§" },
      { "nodeId": "f984a934ad644f8480b0f8f51449569f", "label": "Characters", "icon": "◎" },
      { "nodeId": "df096ab26e8347e6992e95698345aad0", "label": "Locations", "icon": "⌖" }
    ]
  },
  "branding": {
    "appTitle": "Tome",
    "defaultDocumentIcon": "M",
    "staticSiteHeader": "Marloth design corpus"
  },
  "legacy": {
    "exportPathPrefix": "Marloth",
    "archivePathPrefix": "Marloth/Archive"
  }
}
```

### Field reference

| Field | Required | Used by |
| --- | --- | --- |
| `homeNodeId` | yes | Editor home fallback, lifecycle protection |
| `archiveNodeId` | yes | Archive membership hub, graph export exclusion, cache `recomputeArchivedFlags` |
| `protectedNodeIds` | yes | Delete/archive protection (`node-lifecycle.ts`) |
| `graphExplorer.defaultAnchorNodeId` | yes | Graph Explorer LOD anchor default |
| `staticSite.homeNodeId` | yes | Astro landing page (`generate-data.ts`) |
| `quickLinks` | yes (may be `[]`) | Session 02 editor sidebar |
| `branding` | no | Session 02/05 UI strings and favicon |
| `legacy.exportPathPrefix` | no | Session 04 type-membership audit |
| `legacy.archivePathPrefix` | no | Legacy migration scripts, `isLegacyArchivedNotionPath` |

Node ids must match `^[0-9a-f]{32}$`.

## Implementation steps

### 1. New module `packages/tome-db/src/workspace/`

**`workspace-file.ts`**

- Types: `WorkspaceFile`, `WorkspaceQuickLink`, `WorkspaceBranding`, `WorkspaceLegacy`, etc.
- `WORKSPACE_FILE_VERSION = 1`
- `parseWorkspaceFile(json: string): WorkspaceFile` — validate version, node ids, required fields
- `emptyWorkspaceFile(): WorkspaceFile` — only for tests; production should require the file

**`load.ts`**

- `invalidateWorkspaceCache()`
- `loadWorkspaceFromContent(contentDir: string): WorkspaceFile` — mtime cache (mirror [`views/load.ts`](../../packages/tome-db/src/views/load.ts))
- `loadWorkspace(): WorkspaceFile` — default content path via `resolveContentPath()`

### 2. Paths

In [`packages/tome-db/src/content/paths.ts`](../../packages/tome-db/src/content/paths.ts):

- `export const WORKSPACE_FILENAME = "workspace.json"`
- `export function workspaceFilePath(contentRoot: string): string`

### 3. Replace hardcoded constants

Pass `contentDir` where callers already have it; otherwise use `loadWorkspace()` / `loadWorkspaceFromContent(resolveContentPath())`.

| File | Change |
| --- | --- |
| [`queries.ts`](../../packages/tome-db/src/queries.ts) | Replace `DEFAULT_HOME_NODE_ID` with workspace lookup; keep deprecated export alias pointing at loader for one release if needed |
| [`archive-status.ts`](../../packages/tome-db/src/archive-status.ts) | Archive id + `ARCHIVE_NOTION_PATH_PREFIX` from `legacy.archivePathPrefix` |
| [`node-lifecycle.ts`](../../packages/tome-db/src/node-lifecycle.ts) | `PROTECTED_NODE_IDS` from `protectedNodeIds` |
| [`relationship-archive.ts`](../../packages/tome-db/src/relationship-archive.ts) | Archive hub id from workspace (via shared helper) |
| [`graph-export.ts`](../../packages/tome-db/src/graph-export.ts) | `DEFAULT_GRAPH_EXPLORER_ANCHOR_ID` from workspace |
| [`content/sync.ts`](../../packages/tome-db/src/content/sync.ts) | `recomputeArchivedFlags(workspace.archiveNodeId)`; include `workspace.json` in `contentSnapshotMtime()` |

**Cache invalidation:** When the content watcher detects changes under `content/model/`, call `invalidateWorkspaceCache()` alongside existing `invalidateSchemaCache()` / `invalidateViewsCache()` (find watcher in `tome-editor` API or `ContentWatcher`).

**Helper pattern (recommended):**

```typescript
// workspace/resolve.ts
export function resolveWorkspace(contentDir?: string): WorkspaceFile {
  return loadWorkspaceFromContent(contentDir ?? resolveContentPath());
}

export function archiveNodeId(contentDir?: string): string {
  return resolveWorkspace(contentDir).archiveNodeId;
}
```

Avoid calling `loadWorkspaceFromContent` on every graph edge check in hot paths — cache at call site or use the existing mtime cache in `load.ts`.

### 4. Static site

[`packages/tome-static-site/src/generate-data.ts`](../../packages/tome-static-site/src/generate-data.ts):

- Remove `STATIC_SITE_HOME_NODE_ID` constant
- Set `homeNodeId` from `loadWorkspaceFromContent(config.contentDir).staticSite.homeNodeId`
- Update [`generate-data.test.ts`](../../packages/tome-static-site/tests/generate-data.test.ts) to seed workspace.json in test content dir

### 5. Tests

- Add `packages/tome-db/tests/workspace/workspace-file.test.ts` — parse valid/invalid JSON
- Update fixtures in:
  - `archive-status.test.ts`
  - `node-lifecycle.test.ts`
  - `graph-export.test.ts`
  - `node-lifecycle-api.test.ts` (editor API tests that seed home/archive)

Use `createTestContentFixture` and write `workspace.json` into `fixture.ctx.store.contentDir/model/`.

### 6. Validation (optional v1)

Either extend [`scripts/validate-content-model.ts`](../../scripts/validate-content-model.ts) or add `scripts/validate-workspace.ts`:

- Structural: file parses
- Optional: every node id in workspace exists under `content/data/{id}.md`

Add `"validate:workspace": "bun scripts/validate-workspace.ts"` to root `package.json` if you add a script.

### 7. Exports

Export from [`packages/tome-db/src/index.ts`](../../packages/tome-db/src/index.ts):

- `loadWorkspaceFromContent`, `loadWorkspace`, `invalidateWorkspaceCache`
- `WorkspaceFile` type
- Deprecated: `DEFAULT_HOME_NODE_ID` shim if tests still import it — prefer updating tests to workspace fixture

## Do not do in this session

- `GET /api/workspace` or webview sidebar changes ([session 02](./02-editor-workspace-integration.md))
- `ordered-associations.json` ([session 03](./03-ordered-associations-json.md))
- Renaming `MARLOTH_*` env vars ([session 05](./05-legacy-compat-and-cleanup.md))

## Done when

- [ ] `content/model/workspace.json` committed with Marloth values
- [ ] `grep` for hardcoded home/archive/anchor ids in `packages/tome-db/src` (excluding tests and deprecated shims) returns nothing
- [ ] `bun run --filter tome-db test` passes
- [ ] `bun run --filter tome-static-site test` passes (if static site touched)

## Doc updates (minimal)

Add a row to the model files table in [`docs/features/tome-db.md`](../features/tome-db.md):

| `content/model/workspace.json` | Home, archive, protected nodes, sidebar, branding, legacy path prefixes |
