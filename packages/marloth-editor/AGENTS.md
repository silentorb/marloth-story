# Marloth Editor — agent notes

## What it is

Browser editor for Marloth design nodes stored in `content/` with a SQLite query cache. Uses **Milkdown Crepe** for a Notion-like markdown experience with `@` cross-link autocomplete.

## Terminology

- **Node** — graph entity; API `GET/PUT /api/nodes/:id`, search `GET /api/nodes/search`.
- **Page** — `NodePageView` UI for one node (title, metadata, sections).
- **Relationship** — graph relationship; relationship property edits via `/api/nodes/:id/relationships/...`.
- Navigation: `?node={id}` (`standaloneNodeUrl` in `src/webview/node-links.ts`).

## Theme

The editor is **dark-first**: it always uses the `:root` palette in `src/webview/styles.css`. Milkdown loads `frame-dark.css`; code blocks use Crepe’s One Dark CodeMirror theme. New UI should use `--marloth-*` tokens (add tokens to `styles.css` rather than hardcoding colors).

## Architecture

| Layer | Path | Runtime |
| --- | --- | --- |
| Graph queries | `marloth-db` | Bun |
| HTTP API | `src/api/server.ts` | Bun |
| Webview UI | `src/webview/` | Browser (Vite) |

The webview talks to the Bun REST API on `http://127.0.0.1:3847` (proxied as `/api` in dev).

**Data transport:** webview → REST (`src/shared/http-client.ts`).

**Link/navigation convention (read [`docs/features/marloth-editor.md`](../../docs/features/marloth-editor.md) § Cross-linking):** stored markdown bodies use `./{nodeId}.md`; markdown passed to Milkdown uses `?node=` display hrefs (`prepareEditorMarkdown` / `normalizeEditorBody`). **App chrome** (sidebar, tables, search rows, metadata backlinks, etc.) **must** use `<a href="…">` with native browser pointer navigation—no `onClick` / `onAuxClick` / `preventDefault` / imperative routing on those anchors. **Milkdown body** is exempt: use Crepe defaults (`LinkTooltip` on) and JS click handling via `editor-link-navigation.ts` (`navigateStandaloneNode` / `openStandaloneNodeInNewTab`). Other exceptions: Graph Explorer canvas (`api.navigate`), keyboard Enter in combobox pickers. Helpers: `nodePageHref()` in `src/webview/node-links.ts`.

## Run

From repo root:

```bash
# API only (auto-started on devcontainer boot + workspace folder open outside devcontainer)
bun run editor:api
# → http://127.0.0.1:3847

# Browser UI + API (keep terminal open; for webview HMR)
bun run editor:dev
# → http://127.0.0.1:5173
```

Build webview: **Tasks: Run Task** → **Marloth Editor: build**, or `bun run editor:build`.

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
