# Marloth static site — agent notes

## What it is

Astro-based static site generator that exports every node in `content/` to HTML under `dist/web/` (default). Each page mirrors the editor’s read-only node view: metadata (with backlinks), properties, markdown body, Items tables, and relation tables with cross-links. Multi-tab type-table hubs get sibling URLs under `nodes/{id}/tabs/{tabId}/`.

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
- `nodes/{id}/index.html` — one page per content node (default Items tab)
- `nodes/{id}/tabs/{tabId}/index.html` — extra tab pages for multi-tab type-table hubs only
- `_astro/` — bundled assets (includes sort + metadata client script)

## Repo-wide context

- **Feature spec:** [`docs/features/static-website.md`](../../docs/features/static-website.md)
- **Graph storage:** [`docs/features/marloth-db.md`](../../docs/features/marloth-db.md)
- Root [`AGENTS.md`](../../AGENTS.md)
