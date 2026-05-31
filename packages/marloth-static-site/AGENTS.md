# Marloth static site — agent notes

## What it is

Astro-based static site generator that exports every node in `content/` to HTML under `dist/web/` (default). Markdown-only pages: title, path, rendered body with internal links rewritten.

## Run

From repo root:

```bash
bun run web:build
bun run web:build -- --out-dir=/path/to/output --base=/design/
```

From this package:

```bash
bun run build
bun test
```

Help: `bun run web:build -- --help`

## Configuration

CLI overrides environment (see `--help`):

| Flag | Env | Default |
| --- | --- | --- |
| `--out-dir` | `MARLOTH_WEB_OUT_DIR` | `{repoRoot}/dist/web` |
| `--content-dir` | `MARLOTH_CONTENT_PATH` | `./content` |
| `--db-path` | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |
| `--base` | `MARLOTH_WEB_BASE` | `/` |

## Output layout

- `index.html` — node index + link to home node
- `nodes/{id}/index.html` — one page per content node
- `_astro/` — bundled assets

## Repo-wide context

- **Feature spec:** [`docs/features/static-website.md`](../../docs/features/static-website.md)
- **Graph storage:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Root [`AGENTS.md`](../../AGENTS.md)
