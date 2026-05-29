# Marloth-db — agent notes

## What it is
- TypeScript + **Bun**: flat `content/` files (source of truth) + SQLite cache for queries.
- Uses Bun's built-in `bun:sqlite` (no extra native deps).
- Content default: `content/` at repo root. Cache default: `data/marloth.sqlite` (gitignored).

## Terminology

- **Node** — entity in `content/{id}.md` and cache `nodes`.
- **Relationship** — directed labeled link in `content/relationships.json` and cache `relationships`.
- **Page** — editor view of a node (`getNodePageDetail`, `node-page-sections.ts`).
- **Type table** — node with incoming `IS_A` and/or `notion_schema` metadata (`isTypeTableNode`).
- **Schema** — relationship rules in `content/schema.json` ([`docs/features/schema.md`](../../docs/features/schema.md)).

Cache tables: `nodes`, `relationships` (`SCHEMA_VERSION` 6).

## Run
- Tests: `bun test` (from this directory).
- Content API: `marloth-db/content`; writes: `openMarlothWriteContext`.

## Editing data

- **Canonical store:** `content/` — commit markdown + JSON changes.
- Use `ContentStore` / `MarlothWriteContext` for mutations.
- Rebuild cache: `bun run content:sync` from repo root.
- **Do not** edit `data/marloth.sqlite` directly or run `notion:import` / `--clean` for routine updates.

## Repo-wide context
- **Feature spec:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- **Schema rules:** [`docs/features/schema.md`](../../docs/features/schema.md)
- **Dynamic table fields:** [`docs/features/dynamic-table-fields.md`](../../docs/features/dynamic-table-fields.md)
- Graph Explorer LOD export: [`docs/features/graph-explorer.md`](../../docs/features/graph-explorer.md)
- Legacy Notion import / export mining: [`docs/features/notion-import.md`](../../docs/features/notion-import.md)
- Global conventions: repository root [`AGENTS.md`](../../AGENTS.md)
