# Marloth Editor

## Summary

Web-based markdown editor for Marloth design records in the SQLite property graph. Delivered as a **VS Code extension** with a React + Milkdown (Crepe) webview, plus a **standalone browser dev mode** for fast iteration.

## When to read this

Read this doc when your task involves:

- Editing graph record bodies (`body` property on vertices)
- Cross-linking between design records in markdown
- The VS Code Marloth editor extension or its API/webview packages
- Notion-like editing UX for the design corpus

For graph storage semantics, read [`marloth-db.md`](./marloth-db.md) and [`../ontology.md`](../ontology.md).

## Requirements

### Editing model

- The editor **must** read and write the `body` property of graph vertices via `marloth-db`.
- The canonical database path **must** follow `MARLOTH_DB_PATH` / `data/marloth.sqlite` conventions (see marloth-db).
- Autosave **should** debounce writes (default ~800ms after last edit).

### Cross-linking

- Internal links **must** use the `marloth:{recordId}` URL scheme in stored markdown.
- `@` autocomplete **must** search existing records by title and insert a markdown link.
- Clicking a link **must** navigate to the target record:
  - plain click → same editor tab
  - Ctrl/Cmd+click or middle-click → new editor tab (VS Code custom editor instance)
- Legacy Notion export links (32-hex id embedded in path) **should** resolve at navigation time without requiring a bulk migration.

### Entry / navigation

- A **home record** **must** be openable via command palette (`Marloth: Open Home`).
- Default home is the Marloth root page (`72b6fb455b824b78962b0e509cc091c9`) when present in the graph.
- Records **must** open via virtual URIs: `marloth://record/{id}` using a custom editor (`marloth.editor`).

### Dev / agent workflow

- A **standalone browser mode** **must** be supported: Vite dev server + Bun API, without VS Code.
- VS Code development **should** load the webview from the Vite dev server for HMR.
- The extension host **must not** depend on `bun:sqlite`; it **must** use the HTTP API (spawn or connect).

### Out of scope (v0.1)

- Creating new graph records from the UI
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

## Verification

- `bun test packages/marloth-editor/src`
- `bun test packages/marloth-db/src`
- Manual: open home → edit → reload → body persisted
- Manual: `@` search inserts link; click navigates; Ctrl+click opens new tab

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-editor/src/api/server.ts` | Bun HTTP API |
| `packages/marloth-editor/src/webview/` | React + Milkdown Crepe UI |
| `packages/marloth-editor/src/extension/` | VS Code custom editor provider |
| `packages/marloth-db/src/queries.ts` | Record get/search/save helpers |

## See also

- [marloth-db.md](./marloth-db.md)
- [`../ontology.md`](../ontology.md)
- [`packages/marloth-editor/AGENTS.md`](../../packages/marloth-editor/AGENTS.md)
