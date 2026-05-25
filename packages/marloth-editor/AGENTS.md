# Marloth Editor — agent notes

## What it is

VS Code extension + React webview for editing Marloth design records stored in `data/marloth.sqlite`. Uses **Milkdown Crepe** for a Notion-like markdown experience with `@` cross-link autocomplete.

## Architecture

| Layer | Path | Runtime |
| --- | --- | --- |
| Graph queries | `marloth-db` | Bun |
| HTTP API | `src/api/server.ts` | Bun |
| Webview UI | `src/webview/` | Browser / VS Code webview |
| Extension host | `src/extension/` | Node (VS Code) |

The extension host **does not** open SQLite directly. It spawns (or connects to) the Bun REST API on `http://127.0.0.1:3847`.

**Data transport:** webview → REST (`src/shared/http-client.ts`) in all modes. **Navigation transport:** webview → postMessage → extension host (VS Code only).

## Run

From repo root:

```bash
# Browser UI + API (keep terminal open)
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
- Graph storage: [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Root [`AGENTS.md`](../../AGENTS.md)
