# Rippledoc — agent notes

## What it is
- TypeScript + **Bun** + **chokidar**: watches the repo's `content/` tree and runs the content **pipeline** on file changes, so work can ripple through linked documents.
- Source lives in `src/`; bundled output in repo root `dist/rippledoc/` (run `bun run build` after meaningful changes if you rely on the bundle).

## Run
- From this package: `bun run start` (or `bun run src/main.ts`).
- From repo root: `bun run --cwd packages/rippledoc start` or `./scripts/rippledoc`.
- Help: append `-- --help` when using the root `bun run --cwd ...` form.

## Configuration
- Every option is available via **CLI** and **environment**; **CLI wins over env** over defaults.
- Prefer **`RIPPLEDOC_*`** env vars; **`MARLOTH_*`** names are still read as legacy. See `--help` for names and flags.

## Development
- Tests: `bun test` (from this directory).
- Typecheck: `tsc` is configured with `noEmit: true` in `tsconfig.json` — use your editor or `bunx tsc` if you add a check script.
- When changing behavior, update or add tests in `src/*.test.ts` when practical.

## Repo-wide context
- **Feature spec (requirements, rationale, behavior):** [`docs/features/rippledoc.md`](../../docs/features/rippledoc.md)
- Global conventions and feature routing: repository root [`AGENTS.md`](../../AGENTS.md)
