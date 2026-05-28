# Marloth Editor

## Summary

Web-based markdown editor for Marloth design records in the SQLite property graph. Delivered as a **VS Code extension** with a React + Milkdown (Crepe) webview, plus a **standalone browser dev mode** for fast iteration.

## When to read this

Read this doc when your task involves:

- Editing graph record bodies (`body` property on vertices)
- Cross-linking between design records in markdown
- The VS Code Marloth editor extension or its API/webview packages
- Notion-like editing UX for the design corpus
- Graph Explorer (multi-resolution graph visualization)

For graph storage semantics, read [`marloth-db.md`](./marloth-db.md) and [`../ontology.md`](../ontology.md).
For Graph Explorer LOD layers and clustering, read [`graph-explorer.md`](./graph-explorer.md).

## Requirements

### Editing model

- The editor **must** read and write the `body` property of graph vertices via `marloth-db`.
- Every record **must** render as a **universal page** with this block order: **page title** (standalone textarea) → collapsible **metadata** panel → optional **Properties** section → **markdown body** (Milkdown) → optional relationship and database table sections derived from graph edges.
- Instance pages (`NotionPage` with `(page)-[:IS_A]->(type)`) **must** show a **Properties** section when the type defines one or more stored scalar fields and/or dynamic computed fields for that database. Stored scalars (e.g. Priority) are editable; computed dynamic fields are read-only. When Properties is shown, the redundant `IS_A` relationship table section **must** be omitted.
- Relationship tables **must** group outgoing edges by label; edge properties (except import metadata like `ordinal`, `via_database`) **must** appear as table columns.
- Database table sections **must** appear on `NotionDatabase` records, built from incoming `IS_A` edges (Name from linked pages; scalar columns from `IS_A` properties; relation columns from linked targets on outgoing graph edges — see [marloth-db.md](./marloth-db.md) `getDatabaseViewDetail`).
- The canonical database path **must** follow `MARLOTH_DB_PATH` / `data/marloth.sqlite` conventions (see marloth-db).
- Autosave **should** debounce writes (default ~800ms after last edit).
- Local UI preferences (table sort order, etc.) **must** persist in a gitignored user settings file (`.marloth/user-settings.json` by default), storing sparse overrides only—not full copies of graph data.
- Section tables **must** support sortable columns; default sort is Name ascending. Sort preferences **must** persist per section table across sessions.
- Each record page **must** include a collapsible **metadata** panel below the page title and above Properties (when present). Collapsed by default; standalone mode supports `?meta=1` to expand (not persisted in user settings).
- **Connections** — total incident graph edges (in + out). **Backlinks** — prose-only discovery: other pages whose markdown `body` links here (inline `marloth:` or export-style links). Backlinks are a gap-filler for references not already visible in relation/database sections; graph property edges are excluded.
- Database tables **should** use synced Notion view definitions (`notion_views` on `NotionDatabase` vertices) for view tabs, filters, sorts, and typed columns when present; see [notion-metadata-sync.md](./notion-metadata-sync.md).

### Cross-linking

- Internal links **must** use the `marloth:{recordId}` URL scheme in stored markdown.
- `@` autocomplete **must** search existing records by title and insert a markdown link.
- Clicking a link **must** navigate to the target record:
  - plain click → same editor tab
  - Ctrl/Cmd+click or middle-click → new editor tab (VS Code custom editor instance)
- Legacy Notion export links (32-hex id embedded in path) **should** resolve at navigation time without requiring a bulk migration.
- **Standalone browser mode** should use normal `<a href="?record=…">` URLs and native browser navigation (including Ctrl/Cmd+click for new tabs). Avoid `preventDefault`, `window.open`, and other JS overrides where a real link works.
- **VS Code webview** may intercept `marloth:` links (no native target) and route via postMessage; keep that interception minimal and limited to cases without a usable URL.

### Entry / navigation

- A **home record** **must** be openable via command palette (`Marloth: Open Home`).
- Default home is the Marloth root page (`72b6fb455b824b78962b0e509cc091c9`) when present in the graph.
- Records **must** open via virtual URIs: `marloth://record/{id}` using a custom editor (`marloth.editor`).

### Presentation

- The editor UI **must** default to a **dark** theme in standalone browser and VS Code webview modes, independent of OS `prefers-color-scheme` or VS Code workbench theme.
- Shared colors **must** live as `--marloth-*` CSS custom properties on `:root` in `src/webview/styles.css`; canvas or library code that cannot use CSS directly should read those tokens (see `src/webview/theme.ts`).

### Dev / agent workflow

- A **standalone browser mode** **must** be supported: Vite dev server + Bun API, without VS Code.
- VS Code development **should** load the webview from the Vite dev server for HMR.
- The extension host **must not** depend on `bun:sqlite`; it **must** use the HTTP API (spawn or connect).

### Out of scope (v0.1)

- Creating new graph records from the UI
- Editing relationship edges from the UI (except ordered-association reorder/part moves; see [ordered-associations.md](./ordered-associations.md), and stored type-membership scalars in the Properties section)
- Weighted edges or typed link metadata in the editor

## Design rationale

### Notion-like UX on graph data

Design work in Marloth is relational and markdown-heavy. A web editor with `@` linking matches author mental models from Notion while preserving git-tracked SQLite as source of truth.

### HTTP API between extension and graph

VS Code extensions run on Node; `marloth-db` uses Bun's built-in SQLite. A small localhost REST API keeps one database implementation, enables standalone browser testing, and gives agents a simple curl/fetch verification surface.

The webview calls this REST API **directly** in both standalone and VS Code modes (via shared client in `src/shared/http-client.ts`). postMessage is used only for VS Code-specific navigation (same tab vs new editor tab).

### Virtual URIs + custom editor

Without filesystem paths, `marloth://record/{id}` custom editors provide real VS Code tabs, split views, and "open in new tab" semantics analogous to browser navigation.

## Behavior / pipeline

```
User edit (webview)
  → PUT /api/records/:id (shared REST client)
  → marloth-db mergeVertexProperties(body)
  → SQLite data/marloth.sqlite
```

Navigation in VS Code (same tab vs new tab) uses postMessage to the extension host; record data still loads via REST.

Search/autocomplete:

```
@ query → GET /api/records/search?q=… → title/path summaries
```

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `packages/marloth-editor/` | Extension, API, webview |
| `data/marloth.sqlite` | Record bodies and metadata |
| `packages/marloth-editor/dist-webview/` | Production webview bundle |
| `packages/marloth-editor/dist/extension.js` | Extension host bundle |

## Quick start

The editor API and Vite dev server **start automatically** when you attach to the devcontainer (`postAttachCommand`) or open this workspace in VS Code/Cursor (task **Marloth Editor: dev servers**, `runOn: folderOpen`). Manual start: `bash scripts/marloth-editor-start` or `bun run editor:dev`. If Vite is not running, the VS Code extension falls back to the built `dist-webview` bundle.

```bash
# Standalone (browser) — best for rapid UI iteration
bun run editor:dev
# → API http://127.0.0.1:3847  ·  UI http://127.0.0.1:5173

# VS Code extension (F5 after dev:extension watch + editor:dev for webview HMR)
# Command Palette → Marloth: Open Home
```

## Configuration

| Setting | Environment | Default |
| --- | --- | --- |
| Database path | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |
| API port | `MARLOTH_EDITOR_API_PORT` | `3847` |
| Dev webview URL | `MARLOTH_EDITOR_WEBVIEW_URL` | `http://127.0.0.1:5173` |
| User settings file | `MARLOTH_USER_SETTINGS_PATH` | `.marloth/user-settings.json` (repo root) |

## Verification

- `bun test` (repo root — runs marloth-db unit tests and marloth-editor typecheck + unit/component tests)
- `bun run --cwd packages/marloth-editor test` includes `tsc -p tsconfig.check.json` (webview/shared/api)
- Component smoke tests use synthetic fixtures in `src/webview/test-fixtures/` (no real graph content)
- Manual: open home → edit → reload → body persisted
- Manual: `@` search inserts link; click navigates; Ctrl+click opens new tab
- Manual: open any record with relation sections and confirm tables render
- Manual: click a section table column header to sort; reload and confirm sort persists in `.marloth/user-settings.json`

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-editor/src/api/server.ts` | Bun HTTP API |
| `packages/marloth-editor/src/api/user-settings-store.ts` | Local user settings file I/O |
| `packages/marloth-editor/src/shared/user-settings.ts` | User settings types and table sort helpers |
| `packages/marloth-editor/src/webview/` | React + Milkdown Crepe UI |
| `packages/marloth-editor/src/extension/` | VS Code custom editor provider |
| `packages/marloth-editor/src/webview/components/RecordPageView.tsx` | Universal page layout (title, metadata, properties, markdown, sections) |
| `packages/marloth-editor/src/webview/components/PropertiesSectionView.tsx` | Instance-page Properties form (stored + computed fields) |
| `packages/marloth-editor/src/webview/components/RelationSectionView.tsx` | Outgoing relationship table section |
| `packages/marloth-db/src/queries.ts` | Record get/search/save helpers |
| `packages/marloth-db/src/record-sections.ts` | Section assembly for record API |
| `packages/marloth-db/src/page-properties.ts` | Instance-page Properties section (`buildPropertiesSection`) |

## See also

- [marloth-db.md](./marloth-db.md)
- [graph-explorer.md](./graph-explorer.md)
- [ordered-associations.md](./ordered-associations.md)
- [`../ontology.md`](../ontology.md)
- [`packages/marloth-editor/AGENTS.md`](../../packages/marloth-editor/AGENTS.md)
