# Static website generation

Generate a portable, dark-themed static HTML site from every node in `content/`.

## Summary

The `marloth-static-site` package reads the git-tracked design corpus via `marloth-db`, builds one page per node with Astro, and writes output to `dist/web/` by default. The primary use case is embedding this output into a larger parent static site.

## When to read this

- Adding or changing static export behavior
- Configuring output paths or base URL for embedding
- Understanding what each generated page includes

## Requirements

- **Must** include every node returned by `ContentStore.listNodeIds()` (~all `content/data/*.md` files).
- **Must** render title and markdown body per node.
- **Must** rewrite internal graph links (`marloth:{id}` and legacy Notion `{32-hex}.md` paths) to static node URLs.
- **Must** use a dark theme consistent with the Marloth editor palette.
- **Must** write to `dist/web/` by default; output directory **must** be configurable for external tools.
- **Must** support a configurable Astro `base` path for subdirectory embedding.
- **May** expose a VS Code task and root `web:build` script.

## Design rationale

Astro produces plain static HTML suitable for copying into any host or parent build. Reading `content/` through the SQLite cache reuses existing graph queries (`getNodeDetail`) without duplicating parsing logic. Markdown-core pages keep v1 scope small; relation tables and editor parity can follow later.

## Behavior / pipeline

1. `build.ts` parses CLI/env config and sets `MARLOTH_*` env vars.
2. **Generate (Bun):** `generate-data.ts` reads all nodes from `content/` via `ContentStore` (no SQLite) and writes `src/generated/site-data.json` (gitignored).
3. **Build (Astro/Node):** Astro loads the generated JSON (avoids `bun:sqlite`, which Node cannot import).
4. Each node page: strip duplicate title heading, rewrite links, render markdown to HTML.
5. Index page: sorted node list + link to home node id.
6. Astro writes `index.html`, `nodes/{id}/index.html`, and `_astro/` assets.

## Inputs / outputs / artifacts

| Input | Source |
| --- | --- |
| Nodes | `content/data/{id}.md` |
| Relationships (cache) | `content/data/relationships.json` via SQLite rebuild |

| Output | Default path |
| --- | --- |
| Site root | `dist/web/index.html` |
| Node pages | `dist/web/nodes/{id}/index.html` |
| Assets | `dist/web/_astro/` |

Output is gitignored (`**/dist/`).

## Quick start

```bash
bun run web:build
```

VS Code: **Tasks: Run Task** → **Marloth: build static website**.

## Configuration

Precedence: **CLI flags > environment > defaults**.

| Option | CLI | Env | Default |
| --- | --- | --- | --- |
| Output directory | `--out-dir` | `MARLOTH_WEB_OUT_DIR` | `{repoRoot}/dist/web` |
| Content directory | `--content-dir` | `MARLOTH_CONTENT_PATH` | `./content` |
| SQLite cache | `--db-path` | `MARLOTH_DB_PATH` | `data/marloth.sqlite` (unused at build; reserved for future graph-aware export) |
| Site base (embedding) | `--base` | `MARLOTH_WEB_BASE` | `/` |

Embedding example:

```bash
bun run web:build -- --out-dir=/other-project/public/design --base=/design/
```

Copy the output directory into the parent project's static assets; internal links include the base prefix.

## Verification

```bash
bun run --cwd packages/marloth-static-site test
bun run web:build
# open dist/web/index.html or serve dist/web locally
```

## Implementation pointers

| Piece | Path |
| --- | --- |
| Package | `packages/marloth-static-site/` |
| Build entry | `src/build.ts` |
| Content → JSON (Bun) | `src/generate-data.ts` |
| Generated input | `src/generated/site-data.json` (gitignored) |
| Config | `src/config.ts` |
| Astro data loader | `src/lib/content.ts` |
| Markdown + links | `src/lib/markdown.ts` |
| Astro pages | `src/pages/` |
| Dark theme | `src/lib/theme.css` |

## See also

- [`marloth-db.md`](./marloth-db.md) — content store and cache
- [`marloth-editor.md`](./marloth-editor.md) — editor theme and link conventions
- [`packages/marloth-static-site/AGENTS.md`](../packages/marloth-static-site/AGENTS.md)
