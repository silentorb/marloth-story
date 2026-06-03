# Marloth Editor

## Summary

Web-based markdown editor for Marloth design nodes backed by `content/data/` node files and a local SQLite query cache. Delivered as a **VS Code extension** with a React + Milkdown (Crepe) webview, plus a **standalone browser dev mode** for fast iteration.

## When to read this

Read this doc when your task involves:

- Editing graph node bodies (`body` property on nodes)
- Cross-linking between design nodes in markdown
- The VS Code Marloth editor extension or its API/webview packages
- Notion-like editing UX for the design corpus
- Graph Explorer (multi-resolution graph visualization)

For graph storage semantics, read [`marloth-db.md`](./marloth-db.md) and [`../ontology.md`](../ontology.md).
For Graph Explorer LOD layers and clustering, read [`graph-explorer.md`](./graph-explorer.md).

## Requirements

### Editing model

- The editor **must** read and write node bodies via `marloth-db` (`ContentStore` → `content/data/{id}.md`).
- Every node **must** render as a **universal page** with this block order: **page title** (standalone textarea) → collapsible **metadata** panel → optional **Properties** section → **markdown body** (Milkdown) → optional relationship and database table sections derived from graph relationships.
- Because the page title is rendered outside the markdown body, heading levels in stored markdown **must** render one level deeper in the page body (`h1` → rendered `h2`, `h2` → rendered `h3`, etc.).
- Instance pages (`NotionPage` with `(page)-[:IS_A]->(type)`) **must** show a **Properties** section when the type defines one or more stored scalar fields and/or dynamic computed fields for that database. Stored scalars (e.g. Priority) are editable; computed dynamic fields are read-only. When Properties is shown, the redundant `IS_A` relationship table section **must** be omitted.
- Relationship tables **must** group outgoing relationships by label; relationship properties (except import metadata like `ordinal`, `via_database`) **must** appear as table columns.
- Database table sections **must** appear on `NotionDatabase` nodes, built from incoming `IS_A` relationships (Name from linked pages; scalar columns from `IS_A` properties; relation columns from linked targets on outgoing graph relationships — see [marloth-db.md](./marloth-db.md) `getDatabaseViewDetail`).
- The API **must** load `content/` on startup (full cache rebuild if stale), watch `content/data/` and `content/model/` for changes, and sync into `MARLOTH_DB_PATH` (see marloth-db).
- Autosave **should** debounce writes (default ~800ms after last edit).
- Local UI preferences (table sort order, etc.) **must** persist in a gitignored user settings file (`.marloth/user-settings.json` by default), storing sparse overrides only—not full copies of graph data.
- Section tables **must** support sortable columns; default sort is Name ascending. Sort preferences **must** persist per section table across sessions.
- Each node page **must** include a collapsible **metadata** panel below the page title and above Properties (when present). Collapsed by default; standalone mode supports `?meta=1` to expand (not persisted in user settings).
- **Connections** — total incident graph relationships (in + out). **Backlinks** — prose-only discovery: other pages whose markdown `body` links here (inline `marloth:` or export-style links). Backlinks are a gap-filler for references not already visible in relation/database sections; typed graph relationships are excluded.
- Database table sections on type-table nodes **must** use tab definitions from [`views.json`](./views.md): **custom** tabs (name + sorts, editable in UI) or **generated** tabs (e.g. Scenes book scope via `scenes-by-book`). Column typing still comes from synced `notion_schema`; see [notion-metadata-sync.md](./notion-metadata-sync.md). Optional section-level **`columnOrder`** in `views.json` overrides default column ordering; users can drag column headers to reorder and persist that override.
- Database table **relation columns** (`type: relation` in synced `notion_schema`) **must** be editable in the UI: the cell shows a compact summary (max width `14rem`, ~6 lines) of **inline wrapping navigable links** (outline page icon prefix, off-white text—not pill badges) for visible records, with overflow as `N+` when more links exist. In standalone mode those links are plain `<a href="?node=…">` elements (native navigation). An **edit control** in a fixed column immediately right of the links box (shown on cell hover or focus) opens a popup listing all links (remove per row) plus a searchable add control (filtered by the relation property’s target database when `config.database_id` is present). Linking uses `POST /api/nodes/:rowId/connections`; unlinking uses `DELETE /api/nodes/:rowId/connections/:label/:targetId` (edges carry `via_database` scoped to the table).

### Cross-linking and navigation links

**Native link behavior (mandatory).** Any UI that navigates to another node **must** be a real `<a href="…">` anchor. Navigation **must** rely on the browser’s native link behavior (plain click, Ctrl/Cmd+click, middle-click, shift-click, and context-menu actions). **Do not** attach `onClick`, `onAuxClick`, or similar mouse handlers on navigational links; **do not** call `preventDefault()` on link activation; **do not** use `window.open()` or imperative routing for mouse-driven navigation. If a host or widget cannot satisfy this (e.g. no resolvable `href`), **stop and ask** whether an exception is acceptable before adding custom click handling.

| Host | `href` for node pages |
| --- | --- |
| Standalone browser | `?node={id}` (see `standaloneNodeUrl` in `src/webview/node-links.ts`) |
| VS Code webview | `marloth://node/{id}` (see `nodeUri`) |

Keyboard shortcuts in combobox-style pickers (global search, Relate, record link picker) may still call navigation imperatively on **Enter** when focus is in the search field; result rows themselves remain anchors for pointer navigation.

- Internal links **must** be stored in git-tracked markdown as relative sibling paths: `./{nodeId}.md` (see `canonicalNodeMarkdownHref` in `marloth-db/markdown-links.ts`). On load, `prepareEditorMarkdown` expands links in the markdown string to host navigable hrefs (standalone `?node=`, VS Code `marloth://node/…`); on save, `normalizeEditorBody` canonicalizes back to `./{nodeId}.md`. Legacy `marloth:{id}`, `?node=` / `?record=` absolute URLs, and Notion export paths still resolve at read time.
- `@` autocomplete **must** search existing nodes by title and insert a markdown link with a display href (`formatEditorNodeMarkdownLink`).
- Clicking a rendered link **must** navigate to the target node:
  - plain click → same editor tab
  - Ctrl/Cmd+click or middle-click → new editor tab (VS Code custom editor instance)
- Legacy Notion export links (32-hex id embedded in path) **should** resolve at navigation time without requiring a bulk migration.
- **Global search** result rows **must** be `<a href="…">` elements (not `<button>` with `onClick`). Standalone uses `?node=` URLs; VS Code uses `marloth://node/…`.
- Database relation column cell labels, edit-popup row links, section table name cells, and sidebar nav (standalone) follow the same rule: native `<a href>` in standalone; prefer `href` in VS Code where possible.
- **Milkdown body** receives display hrefs in the markdown passed to Crepe (`prepareEditorMarkdown`); persisted bodies remain `./{nodeId}.md` after save. VS Code may still use a delegated click listener for `marloth://` in the webview; do not copy custom click handling to other surfaces without an explicit exception.

### Entry / navigation

- A **home node** **must** be openable via command palette (`Marloth: Open Home`).
- Default home is the Marloth root page (`72b6fb455b824b78962b0e509cc091c9`) when present in the graph.
- Nodes **must** open via virtual URIs: `marloth://node/{id}` using a custom editor (`marloth.editor`).
- A **global search** widget **must** let users find and open any node by title (via `GET /api/nodes/search`). Each result **must** be a native link (`<a href>` per **Native link behavior** above). A configuration bar offers **Search node contents** (markdown body); when enabled, the client passes `includeBody=1` and title matches are listed before body-only matches. When **Search node contents** is on and the query matches a node body, each result may include a `matchPreview` excerpt (up to two lines, match emphasized) below the title; title-only matches show the title line only. The preference is stored in `.marloth/user-settings.json` (`globalSearch.includeBody`). Open via sidebar **Search**, command palette (`Marloth: Search`), or **Ctrl/Cmd+K** (standalone browser and VS Code when the Marloth editor is active). Enter (with focus in the search field) opens the highlighted result; Ctrl/Cmd+Enter or pointer modifier-click use native new-tab behavior where the host supports it. `@` mention and Relate pickers use title-only search (no `includeBody`).

### Presentation

- The editor UI **must** default to a **dark** theme in standalone browser and VS Code webview modes, independent of OS `prefers-color-scheme` or VS Code workbench theme.
- Shared colors **must** live as `--marloth-*` CSS custom properties on `:root` in `src/webview/styles.css`; canvas or library code that cannot use CSS directly should read those tokens (see `src/webview/theme.ts`).
- Editable **enum** property fields (Properties section and database/relation table cells) **should** use collapsed pill labels that open a popover option list on click (Notion-like), not native `<select>` controls. Empty values **must** show a muted placeholder until the user picks an option—never display a schema default as if it were already stored.

### Dev / agent workflow

- A **standalone browser mode** **must** be supported: Vite dev server + Bun API, without VS Code.
- VS Code development **should** load the webview from the Vite dev server for HMR.
- The extension host **must not** depend on `bun:sqlite`; it **must** use the HTTP API (spawn or connect).

### Node creation

- **New page** (sidebar **New page**, command **Marloth: New Page**, or standalone `?view=create`) **must** immediately create a standalone `NotionPage` with default title `Untitled` (no relationships) and open the universal node edit page so the user can set title and body there.
- **Table section add row** — relation sections and database table sections **must** offer an inline add control that creates a new node and links it to the current page (`POST /api/nodes/:id/relation-rows` or `POST /api/databases/:id/rows`). The new row **must** appear after reload.
- Relation table sections only appear when the page already has at least one outgoing edge for that label; ordered-association tables are unchanged. Every non-protected node page **must** offer **Relate** in the page actions menu (⋯ to the right of the page title) to open a dialog linking the current page to an **existing** target: searchable relationship type (`GET /api/relationship-types`, all types present in data) and searchable target node (`GET /api/nodes/search`, optionally filtered via `GET /api/nodes/:id/relationship-link-options?type=…` from `schema.json`). Linking uses `POST /api/nodes/:id/connections`; the page reloads so new relation sections appear when applicable.
- Database table **relation columns** (`type: relation` in synced `notion_schema`) **must** be editable in the UI (link/unlink existing rows via the same connections API).

### Out of scope (v0.1)

- Editing relationships from the UI beyond: ordered-association reorder/part moves (see [ordered-associations.md](./ordered-associations.md)), stored type-membership scalars in the Properties section, **create** flows that mint new target nodes (relation/database add row), **link existing targets** (Relate dialog + database relation columns), and enum/scalar patches on existing edges
- Weighted relationships or typed link metadata in the editor

## Design rationale

### Notion-like UX on graph data

Design work in Marloth is relational and markdown-heavy. A web editor with `@` linking matches author mental models from Notion while preserving git-tracked `content/` files as source of truth and a SQLite cache for fast graph queries.

### HTTP API between extension and graph

VS Code extensions run on Node; `marloth-db` uses Bun's built-in SQLite. A small localhost REST API keeps one database implementation, enables standalone browser testing, and gives agents a simple curl/fetch verification surface.

The webview calls this REST API **directly** in both standalone and VS Code modes (via shared client in `src/shared/http-client.ts`). postMessage is used only for VS Code-specific navigation (same tab vs new editor tab).

### Virtual URIs + custom editor

Without filesystem paths, `marloth://node/{id}` custom editors provide real VS Code tabs, split views, and "open in new tab" semantics analogous to browser navigation.

## Behavior / pipeline

```
User edit (webview)
  → PUT /api/nodes/:id (shared REST client)
  → marloth-db mergeNodeProperties(body)
  → SQLite data/marloth.sqlite
```

Navigation in VS Code (same tab vs new tab) uses postMessage to the extension host for Milkdown `marloth:` links and keyboard-driven pickers; UI surfaces use `<a href="marloth://node/{id}">` anchors. Node data still loads via REST.

In standalone browser mode, changing nodes is a real URL navigation (`?node=`). The browser back/forward buttons use normal history entries—not an in-app navigation stack.

Search/autocomplete:

```
@ query → GET /api/nodes/search?q=… → title summaries
Global search (Ctrl/Cmd+K) → same endpoint; optional `includeBody=1`; empty query lists recent nodes by title
```

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `packages/marloth-editor/` | Extension, API, webview |
| `data/marloth.sqlite` | Node bodies and metadata |
| `packages/marloth-editor/dist-webview/` | Production webview bundle |
| `packages/marloth-editor/dist/extension.js` | Extension host bundle |

## Quick start

The editor API and Vite dev server **start automatically** when you attach to the devcontainer (`postAttachCommand`) or open this workspace in VS Code/Cursor (task **Marloth Editor: dev servers**, `runOn: folderOpen`). Manual start: `bash scripts/marloth-editor-start` or `bun run editor:dev`. If Vite is not running, the VS Code extension falls back to the built `dist-webview` bundle.

```bash
# Standalone (browser) — best for rapid UI iteration
bun run editor:dev
# → UI http://127.0.0.1:5173 (Vite proxies /api to the editor API on port 3847)
# Open the UI URL in the browser; do not open the API port directly.

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
- **Regression tests:** bug fixes for table views, dynamic fields, or related API endpoints must include a failing test seeded with composite relationship types when graph traversal is involved (see root `AGENTS.md`).

### Test coverage map

| Requirement | Primary tests |
| --- | --- |
| Database table assembly (`getDatabaseViewDetail`) | `packages/marloth-db/src/database-view.test.ts`, `database-view-relations.test.ts` |
| Ordered-association part tables | `packages/marloth-db/src/ordered-associations.test.ts` |
| Dynamic computed columns | `packages/marloth-db/src/dynamic-fields/dynamic-fields.test.ts` |
| Composite relationship traversal | `packages/marloth-db/src/relationship-traverse.test.ts` |
| Database table UI | `packages/marloth-editor/src/webview/components/DatabaseTableView.test.tsx` |
| Shared sortable table UI | `packages/marloth-editor/src/webview/components/SectionDataTable.test.tsx` |
| Relation / enum cell rendering | `table-cell-render.test.tsx`, `RelationSectionView.test.tsx`, `EnumSelectCell.test.tsx` |
| Database HTTP API | `packages/marloth-editor/src/api/database-view-api.test.ts`, `edge-property-api.test.ts` |
| Table sort persistence | `packages/marloth-editor/src/shared/user-settings.test.ts`, `user-settings-api.test.ts` |
| Properties section (stored + dynamic) | `NodePageView.test.tsx`, `node-type-properties.test.ts` |

- Manual: open home → edit → reload → body persisted
- Manual: `@` search inserts link; click navigates; Ctrl+click opens new tab
- Manual: open any node with relation sections and confirm tables render
- Manual: click a section table column header to sort; reload and confirm sort persists in `.marloth/user-settings.json`
- Manual: sidebar **New page** or `?view=create` → lands on new node page titled Untitled; `content/data/{id}.md` exists
- Manual: on a relation or database table section, **+ New …** / **+ New row** → new row appears after reload
- Manual: on a database table with relation columns (e.g. Features → Parents), click link labels to navigate; hover the cell and use the edit control to open the popup for add/remove; confirm `content/data/relationships.json` updates

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-editor/src/api/server.ts` | Bun HTTP API |
| `packages/marloth-editor/src/api/user-settings-store.ts` | Local user settings file I/O |
| `packages/marloth-editor/src/shared/user-settings.ts` | User settings types and table sort helpers |
| `packages/marloth-editor/src/webview/` | React + Milkdown Crepe UI |
| `packages/marloth-editor/src/extension/` | VS Code custom editor provider |
| `packages/marloth-editor/src/webview/components/NodePageView.tsx` | Universal page layout (title, metadata, properties, markdown, sections) |
| `packages/marloth-editor/src/webview/App.tsx` (`createNewPage`) | New-page auto-create + navigation |
| `packages/marloth-editor/src/webview/components/GlobalSearch.tsx` | Global node search (title-only v1) |
| `packages/marloth-db/src/node-create.ts` | Create node + optional relationship (`createNode`) |
| `packages/marloth-editor/src/webview/components/PropertiesSectionView.tsx` | Instance-page Properties form (stored + computed fields) |
| `packages/marloth-editor/src/webview/components/RelationSectionView.tsx` | Outgoing relationship table section |
| `packages/marloth-db/src/queries.ts` | Node get/search/save helpers |
| `packages/marloth-db/src/node-page-sections.ts` | Section assembly for node page API |
| `packages/marloth-db/src/page-properties.ts` | Instance-page Properties section (`buildPropertiesSection`) |

## See also

- [marloth-db.md](./marloth-db.md)
- [graph-explorer.md](./graph-explorer.md)
- [ordered-associations.md](./ordered-associations.md)
- [`../ontology.md`](../ontology.md)
- [`packages/marloth-editor/AGENTS.md`](../../packages/marloth-editor/AGENTS.md)
