# Marloth Editor — agent notes

## What it is

VS Code extension + React webview for editing Marloth design nodes stored in `data/marloth.sqlite`. Uses **Milkdown Crepe** for a Notion-like markdown experience with `@` cross-link autocomplete.

## Terminology

- **Node** — graph entity; API `GET/PUT /api/nodes/:id`, search `GET /api/nodes/search`.
- **Page** — `NodePageView` UI for one node (title, metadata, sections).
- **Relationship** — graph relationship; relationship property edits via `/api/nodes/:id/relationships/...`.
- Navigation: `marloth://node/{id}`, standalone `?node=`, commands `marloth.openHome` / `marloth.openNode`.

## Theme

The editor is **dark-first**: it always uses the `:root` palette in `src/webview/styles.css`, not the host OS or VS Code workbench theme. Milkdown loads `frame-dark.css`; code blocks use Crepe’s One Dark CodeMirror theme. New UI should use `--marloth-*` tokens (add tokens to `styles.css` rather than hardcoding colors).

## Architecture

| Layer | Path | Runtime |
| --- | --- | --- |
| Graph queries | `marloth-db` | Bun |
| HTTP API | `src/api/server.ts` | Bun |
| Webview UI | `src/webview/` | Browser / VS Code webview |
| Extension host | `src/extension/` | Node (VS Code) |

The extension host **does not** open SQLite directly. It spawns (or connects to) the Bun REST API on `http://127.0.0.1:3847`.

**Data transport:** webview → REST (`src/shared/http-client.ts`) in all modes. **Navigation transport:** webview → postMessage → extension host (VS Code only).

**Link/navigation convention (read [`docs/features/marloth-editor.md`](../../docs/features/marloth-editor.md) § Cross-linking):** navigational UI **must** use `<a href="…">` and native browser link behavior—**never** `onClick` / `onAuxClick` / `preventDefault` / `window.open` on node links. Standalone: `?node=` (`standaloneNodeUrl`); VS Code: `marloth://node/{id}` (`nodeUri`). Helper: `nodePageHref()` in `src/webview/node-links.ts`. If you cannot use a real `href`, **ask the user** before adding custom click handling. Exceptions: Graph Explorer canvas, Milkdown `marloth:` delegation in VS Code only, keyboard Enter in combobox pickers.

## Run

From repo root:

```bash
# API only (auto-started on devcontainer attach + workspace folder open)
bun run editor:api
# → http://127.0.0.1:3847

# Browser UI + API (keep terminal open; for webview HMR)
bun run editor:dev
# → http://127.0.0.1:5173
```

Build (webview + extension): **Tasks: Run Task** → **Marloth Editor: build**, or `bun run editor:build`.

VS Code extension: F5 → **Marloth Editor: Extension** (requires `editor:dev` running for HMR in dev mode).

## Commands

- `marloth.openHome` — open home node (Marloth root page)
- `marloth.openNode` — open by 32-char node id
- `marloth.search` — open global node search (Ctrl/Cmd+K when Marloth editor is active)

## Tests

```bash
bun test packages/marloth-editor/src
bun test packages/marloth-db/src
```

### Regression tests

When fixing table-view bugs, add a regression test in the same change. Prefer `seedTestCompositeRelationships` (or full `ContentStore` sync) for graph traversal bugs so tests match production `relationships.json` composite types. Do not close a bug fix without a test unless the user explicitly waives it.

**Table layout / column width / horizontal scroll:** extend [`src/webview/components/database-table-layout.test.tsx`](src/webview/components/database-table-layout.test.tsx). It checks CSS max-width values and scroll-container rules.

## Repo-wide context

- Feature spec: [`docs/features/marloth-editor.md`](../../docs/features/marloth-editor.md)
- Graph Explorer: [`docs/features/graph-explorer.md`](../../docs/features/graph-explorer.md)
- Graph storage: [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Root [`AGENTS.md`](../../AGENTS.md)
