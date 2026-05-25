# Notion-importer — agent notes

## What it is
- TypeScript + **Bun**: imports Notion exports into the repo’s flat `content/` markdown corpus, rewrites links, and writes manifest/report files under `docs/`.
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
- For Marloth Story layout, Notion import docs, and global conventions, see the repository root `AGENTS.md` and `docs/notion-conversion.md`.
