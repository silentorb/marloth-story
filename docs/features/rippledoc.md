# Rippledoc

## Summary

Rippledoc watches the repo's `content/` tree and runs a content **pipeline** when markdown files change, so updates can ripple through linked documents. Implementation lives in `packages/rippledoc`. The pipeline hook is currently a **placeholder** — it logs changes but does not yet transform linked files.

## When to read this

Read this doc when your task involves:

- `packages/rippledoc/`, the content watcher, or rippling updates through linked docs
- Watch modes (native, polling, audit) or debounce/poll configuration
- Extending or implementing the content pipeline in `src/pipeline.ts`

## Requirements

### Watching

- Rippledoc **must** watch the configured content directory (default `content/` relative to repo root) for `.md` file add, change, and unlink events.
- Paths under `node_modules/`, `dist/`, and `.git/` **must** be ignored.
- File events **must** be debounced (default 200 ms) before invoking the pipeline.

### Watch modes

- **native** — chokidar native filesystem events (default).
- **polling** — chokidar polling at `poll-interval-ms` (default 1000 ms).
- **audit** — native chokidar plus periodic reconciliation scan at `audit-interval-ms` (default 5000 ms); warn-only audit path must not invoke the side-effect pipeline.

### Pipeline contract

- `runPipelineForPath(absPath, kind)` **must** be the single side-effect entry for "file X changed; update related files."
- `kind` is one of `add`, `change`, `unlink`.
- The audit reconciliation path **must not** call the side-effect pipeline (warn-only).

### Configuration precedence

- CLI flags **must** override environment variables, which override defaults.

## Design rationale

### Separate watcher from import

- Notion import is batch-oriented; rippledoc is continuous. Keeping them in separate packages avoids coupling re-import logic to live editing.

### Debounced pipeline

- **Goal:** avoid redundant work when editors save multiple times or touch related files in quick succession.
- **Trade-off:** up to `debounce-ms` delay before ripple effects run.

### Audit mode

- **Goal:** detect missed filesystem events on unreliable mounts (e.g. some network or VM shares) without silently dropping changes.
- Reconciliation is warn-only so audit does not double-run destructive pipeline work.

### Placeholder pipeline

- The pipeline is intentionally stubbed while content-ripple rules are still being designed. The watcher, config, and audit infrastructure are real; behavior to propagate through links is future work.

## Behavior / pipeline

1. **Startup** — resolve config; verify content directory exists; log mode and paths.
2. **Watch** — chokidar on content dir; on `.md` add/change/unlink, schedule debounced handler.
3. **Pipeline** — call `runPipelineForPath` (currently logs path and kind only).
4. **Audit** (audit mode) — seed fingerprint snapshot; periodic scan compares disk to snapshot; updates snapshot after pipeline runs.
5. **Shutdown** — on SIGINT/SIGTERM, close watcher and audit timer.

Future pipeline stages (not yet implemented): parse links from changed file → find dependents → apply transforms → write updates.

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `content/` | Watched markdown corpus (from Notion import or hand-authored) |
| `packages/rippledoc/src/pipeline.ts` | Pipeline entry (side effects) |
| `packages/rippledoc/src/audit.ts` | Audit-mode fingerprint and reconciliation |
| Console logs | `[rippledoc]` prefixed status and pipeline invocations |

No generated artifacts under `docs/` today.

## Quick start

From the repository root:

```bash
bun run --cwd packages/rippledoc start
# or
./scripts/rippledoc
# or root shortcut:
bun run watch
```

Help:

```bash
bun run --cwd packages/rippledoc start -- --help
```

## Configuration

Precedence: **CLI > environment > defaults**. Prefer `RIPPLEDOC_*` env vars; `MARLOTH_*` names are legacy aliases.

| Setting | CLI | Environment (preferred) |
| --- | --- | --- |
| Watch mode | `--watch-mode native\|polling\|audit` | `RIPPLEDOC_WATCH_MODE` |
| Repo root | `--repo-root <path>` | `RIPPLEDOC_REPO_ROOT` |
| Content dir | `--content-dir <rel>` | `RIPPLEDOC_CONTENT_DIR` |
| Debounce | `--debounce-ms <n>` | `RIPPLEDOC_DEBOUNCE_MS` |
| Poll interval | `--poll-interval-ms <n>` | `RIPPLEDOC_POLL_INTERVAL_MS` |
| Audit interval | `--audit-interval-ms <n>` | `RIPPLEDOC_AUDIT_INTERVAL_MS` |

## Verification

- **Unit tests:** `bun test` from `packages/rippledoc/`.
- **Manual:** start rippledoc, edit a file under `content/`; confirm debounced `[rippledoc] pipeline change …` log line.
- **Audit mode:** `--watch-mode audit`; confirm initial snapshot log and periodic reconciliation without duplicate pipeline side effects from audit alone.

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | CLI entry, signal handling |
| `src/config.ts` | CLI/env resolution, help text |
| `src/watcher.ts` | chokidar setup, debounce, audit integration |
| `src/pipeline.ts` | Side-effect pipeline (stub) |
| `src/audit.ts` | Fingerprint snapshot and reconciliation |
| `src/fingerprint.ts` | File fingerprint helpers |

Bundled output: `dist/rippledoc/` (run `bun run build` in the package after meaningful changes if using the bundle).

When implementation and this doc disagree, treat **this doc as authoritative** until one is updated explicitly.

## See also

- [notion-import.md](./notion-import.md) — populates `content/` from Notion
- [`packages/rippledoc/AGENTS.md`](../../packages/rippledoc/AGENTS.md) — run, test, dev notes
- [`AGENTS.md`](../../AGENTS.md) — repo router and conventions
