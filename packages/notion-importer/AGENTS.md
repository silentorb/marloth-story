# Notion-importer — agent notes

## What it is
- TypeScript + **Bun**: **legacy** pipeline that imported Notion exports into `data/marloth.sqlite` and wrote manifest/report files under `docs/`. **Not the ongoing update path** — edit the graph directly; reuse parsing helpers to mine `./exports/` when needed.
- Graph storage API: `marloth-db` workspace package.
- Source lives in `src/`; bundled output in repo root `dist/notion-importer/` (run `bun run build` after meaningful changes if you rely on the bundle).

## Run
- From this package: `bun run start` (or `bun run src/main.ts`).
- From repo root: `bun run notion:import` or `./scripts/notion-importer`.
- Help: append `-- --help` when using the root `bun run notion:import` form.

## Configuration
- Every option is available via **CLI** and **environment**; **CLI wins over env** over defaults. See `--help` for names and flags.
- `NOTION_EXPORT_DIR` sets the export source when `--source` is omitted.

## Development
- Tests: `bun test` (from this directory).
- Typecheck: `tsc` is configured with `noEmit: true` in `tsconfig.json`.
- When changing behavior, update or add tests in `src/*.test.ts` when practical.

## Repo-wide context
- **Feature spec (requirements, rationale, behavior):** [`docs/features/notion-import.md`](../../docs/features/notion-import.md)
- **Graph database:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Global conventions and feature routing: repository root [`AGENTS.md`](../../AGENTS.md)
