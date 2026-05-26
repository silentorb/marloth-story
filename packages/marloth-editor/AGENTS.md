# Marloth Editor — agent notes

## What it is

VS Code extension + React webview for editing Marloth design records stored in `data/marloth.sqlite`. Uses **Milkdown Crepe** for a Notion-like markdown experience with `@` cross-link autocomplete.

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

**Link/navigation convention:** prefer real URLs and native browser behavior in standalone mode (`src/webview/record-links.ts`). Stored markdown still uses `marloth:{id}`; the standalone UI rewrites rendered anchors to `?record=` query URLs. Only intercept clicks when no native URL exists (VS Code `marloth:` links). Canvas/graph clicks are an exception.

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

- `marloth.openHome` — open home record (Marloth root page)
- `marloth.openRecord` — open by 32-char record id

## Tests

```bash
bun test packages/marloth-editor/src
bun test packages/marloth-db/src
```

## Repo-wide context

- Feature spec: [`docs/features/marloth-editor.md`](../../docs/features/marloth-editor.md)
- Graph Explorer: [`docs/features/graph-explorer.md`](../../docs/features/graph-explorer.md)
- Graph storage: [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Root [`AGENTS.md`](../../AGENTS.md)
