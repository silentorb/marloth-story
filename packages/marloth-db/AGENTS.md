# Marloth-db — agent notes

## What it is
- TypeScript + **Bun**: local SQLite property-graph storage for Marloth story data.
- Uses Bun's built-in `bun:sqlite` (no extra native deps).
- Database file default: `data/marloth.sqlite` at repo root.

## Run
- Tests: `bun test` (from this directory).
- Schema and graph API: import from `marloth-db` workspace package.

## Editing data

- **Canonical file:** `data/marloth.sqlite` at repo root — commit changes directly.
- Use `GraphDatabase` without `{ clean: true }` unless intentionally wiping a dev copy.
- **Do not** run `bun run notion:import` / `--clean` to apply routine graph or schema updates.
- Missing data in `./exports/` only: mine the relevant `.md`/`.csv` and upsert surgically (see [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md) **Editing the graph**).

## Repo-wide context
- **Feature spec:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Graph Explorer LOD export: [`docs/features/graph-explorer.md`](../../docs/features/graph-explorer.md)
- Legacy Notion import / export mining: [`docs/features/notion-import.md`](../../docs/features/notion-import.md)
- Global conventions: repository root [`AGENTS.md`](../../AGENTS.md)
