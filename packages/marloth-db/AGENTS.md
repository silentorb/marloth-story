# Marloth-db — agent notes

## What it is
- TypeScript + **Bun**: local SQLite property-graph storage for Marloth story data.
- Uses Bun's built-in `bun:sqlite` (no extra native deps).
- Database file default: `data/marloth.sqlite` at repo root.

## Run
- Tests: `bun test` (from this directory).
- Schema and graph API: import from `marloth-db` workspace package.

## Repo-wide context
- **Feature spec:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Notion import into the graph: [`docs/features/notion-import.md`](../../docs/features/notion-import.md)
- Global conventions: repository root [`AGENTS.md`](../../AGENTS.md)
