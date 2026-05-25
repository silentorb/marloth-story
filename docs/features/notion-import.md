# Notion import

## Summary

The Notion import feature transforms narrative and database content from a Notion export into a **flat**, cross-linked markdown corpus under `content/`, plus machine-readable metadata under `docs/` for tooling and AI. Implementation lives in `packages/notion-importer`.

## When to read this

Read this doc when your task involves:

- Notion export → `content/` import or re-import
- `packages/notion-importer/`, `external/notion/`, or `./exports/`
- Link rewriting, YAML front matter, index files, or the import manifest
- Changing flat-corpus layout or import conventions

## Requirements

### Source resolution

- The pipeline **must** accept a directory or `.zip` export path via `--source` or `NOTION_EXPORT_DIR`.
- By default, the pipeline **must** prefer the most recently modified entry in `./exports/`; if `./exports/` is empty or missing, it **must** fall back to `external/notion/`.
- Zip sources **must** be extracted to a temporary directory for the run. Nested part archives (e.g. `ExportBlock-…-Part-1.zip`) **must** be unpacked recursively until only pages and CSVs remain.

### Output layout

- Every emitted markdown file **must** live directly under `content/` — no per-table or per-plot subdirectories.
- Stable row identity **must** be the **32-hex Notion id** in the filename and in YAML front matter, not the former export folder path.
- Original export files under `external/notion/` **must** keep Notion exporter names; emitted `content/` names **must** be URL-friendly slugs (see Filenames below).

### Filenames

- **Source** (export tree): Notion's `{title} {32-hex id}.md` pattern; recorded as `source_export`.
- **Output** (`content/`): `{url-slug}-{32-hex id}.md` — lowercase, spaces → hyphens, apostrophes removed, other punctuation folded to hyphens (runs collapsed), Unicode letters ASCII-slug normalized. If no readable title segment remains, use stub `page` before the id.
- Human-readable title **must** appear in YAML `title` and the leading `#` heading when present, not only in the filename.

### Index files (database CSV views)

For each `*.csv` matching Notion database export naming (`Name {database_id}.csv`, `Name {id}_all.csv`, `Name {id}_all_1.csv`, etc.), the pipeline **must** emit **one** markdown file with:

- Front matter: `type: notion-index`, `view`, `source_export`, optional `notion_database` (32-hex id when parseable).
- A GitHub Flavored Markdown table: CSV column headers with emojis removed; duplicate names after stripping get deterministic suffixes.

**Index naming** (peers in `content/`):

- `index-{database_id}-{view}.md` when parseable (database and view keys lowercased; underscores in view → hyphens).
- On collision: `index-{db}-{view}-{hash}.md`.
- Unparseable CSV basenames: `index-{hash}-unparsed.md` from a hash of the source path.

Links in table cells in Notion `Label (path.md)` or `Label (path.csv)` form **must** be rewritten to flat `content/` targets (row `.md` or generated index for that `.csv`).

### Link rewriting

- Canonical navigation **must** use path-relative markdown links in the same directory, e.g. `[Label](my-page-title-<notion-id>.md)`.
- Resolution order:
  1. Resolve Notion `Label (../relative/path%20to%20File%20{id}.md)` and `.csv` forms using the resolved export path.
  2. Map `.csv` paths to the generated index file for that CSV.
  3. If path match fails, fall back to the **32-hex id** in the path to find the target `content/` file.
- GitHub blob URLs **must not** be the primary navigation format.

Some links **may** remain unresolved after import (deleted pages, stale ids, CSV-only rows). The pipeline **must** report these in `docs/notion-link-report.txt` and run a post-import sanity check written to `docs/notion-link-check.txt`.

### Property names and emojis

- Generated table headers and YAML keys **must** have emojis stripped from property **names**.
- Property **values** (prose, relation lists) **must not** be altered for emoji unless they are clearly property labels at the start of a line.

### YAML front matter (imported pages)

Each content note (not `notion-index` files) **must** be emitted with a leading block including at minimum:

```yaml
---
title: "…"
notion_id: "…"
aliases:
  - "…"
source_export: "external/notion/…"
inferred_notion_path: "…"
---
```

- `title`: from first `#` heading, or parsing rules when empty.
- `notion_id`: 32-hex id from source filename.
- `aliases`: at least a short Obsidian-suitable form (title with trailing ` {id}` removed when it matches).
- `source_export`: repo-relative path to original exported `.md`.
- `inferred_notion_path`: parent path inside export, for logical grouping.
- Scalar `Name: value` lines before the body **must** be promoted to front matter with slugified, emoji-stripped keys. Keys colliding with reserved names **must** be prefixed (e.g. `prop_…`).
- Large relation fields **may** remain in the body under `##` sections with link rewriting applied.

### Manifest and reports

- The pipeline **must** write `docs/notion-import-manifest.json` listing each output file with `notion_id`, `source_export`, `output`, `inferred_notion_path` (pages), and for indexes `type: "notion-index"`, `notion_database`.
- The pipeline **must** be **idempotent**: the same export tree yields the same logical output.

### Clean mode

- With `--clean`, the pipeline **must** remove existing generated `content/*.md` notes before writing new output (one-shot full replace).

## Design rationale

### Flat `content/` vault

- **Goal:** experiment with a flat, vault-style corpus navigable via search, generated index tables, manifest, and AI — not directory browsing.
- **Rejected:** mirroring Notion's export tree under `content/` — deep trees duplicate structure already captured in `inferred_notion_path` and manifest, and complicate cross-linking.
- **Trade-off:** GitHub shows a long single-directory listing; accepted in favor of stable ids and simpler relative links.

### Relative markdown links

- **Goal:** links work in local editors, GitHub preview, and Obsidian without network or branch-specific URLs.
- **Rejected:** GitHub blob URLs as canonical navigation — they break offline and across branches.

### Manifest as primary tooling hook

- **Goal:** filter by database id, feed future vector stores and watches, and enable mechanical re-partitioning by topic/table without relying on directory layout.
- Directory structure is intentionally not the source of truth for "which rows belong together."

### Emoji stripping on names only

- **Goal:** tool-friendly diffs, search, and YAML keys while preserving author voice in prose values.

## Behavior / pipeline

High-level stages (regen-friendly; see `packages/notion-importer/src/` for modules):

1. **Resolve source** — pick export dir/zip (`exports/` → `external/notion/` or override); extract zips recursively.
2. **Discover inputs** — walk export tree for `.md` pages and database `.csv` views.
3. **Parse pages** — split Notion export into front matter candidates and body; extract ids and titles.
4. **Emit indexes** — for each CSV, build GFM table and index front matter; assign flat filename.
5. **Emit pages** — write slugged filenames, format YAML, preserve relation sections in body.
6. **Build link map** — map export paths and ids → flat `content/` outputs (including csv → index).
7. **Rewrite links** — second pass over all emitted markdown; record unresolved links.
8. **Write artifacts** — manifest JSON, link report, link-check report.
9. **Clean** (optional) — delete prior generated notes when `--clean` is set.

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `./exports/` | Preferred export drop zone (most recent wins) |
| `external/notion/` | Fallback committed export tree |
| `content/*.md` | Flat imported pages and index files |
| `docs/notion-import-manifest.json` | Per-file metadata (`notion_id`, `source_export`, `output`, index fields) |
| `docs/notion-link-report.txt` | Unresolved Notion-style links during rewrite |
| `docs/notion-link-check.txt` | Relative link targets in `content/` that do not exist |

### Manifest entry shape

Pages typically include: `notion_id`, `source_export`, `output`, `inferred_notion_path`.

Index files include: `type: "notion-index"`, `source_export`, `output`, `notion_database` when known.

## Quick start

From the repository root (Bun required):

```bash
# default: prefers ./exports, falls back to ./external/notion
bun run notion:import
```

Full replace of generated `content/*.md`:

```bash
bun run notion:import -- --clean
```

Specific export directory or zip:

```bash
bun run notion:import -- --source ./exports/my-export.zip
```

Alternative entry points: `./scripts/notion-importer` or `bun run --cwd packages/notion-importer start`.

## Configuration

Every option is available via **CLI** and **environment**; precedence is **CLI > env > defaults**.

| Setting | CLI | Environment |
| --- | --- | --- |
| Export source | `--source <path>` | `NOTION_EXPORT_DIR` |
| Full replace | `--clean` | — |
| Repo root | `--repo <path>` | — |

See `bun run notion:import -- --help` for full flag list.

## Verification

- **Unit tests:** `bun test` from `packages/notion-importer/`.
- **Manifest:** after import, `docs/notion-import-manifest.json` lists all expected outputs.
- **Link reports:** inspect `docs/notion-link-report.txt` and `docs/notion-link-check.txt` for broken or missing targets.
- **Idempotency:** re-run on the same export; logical output should not change except for intentional parser updates.

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | CLI entry |
| `src/config.ts` | CLI/env resolution |
| `src/pipeline.ts` | Orchestration, manifest, clean |
| `src/parse.ts` | Page splitting and front matter |
| `src/indexes.ts` | CSV → index markdown |
| `src/links.ts` | Link map and rewrite pass |
| `src/tables.ts` | GFM table generation |
| `src/yamlfmt.ts` | Front matter formatting |
| `src/ids.ts`, `src/textutil.ts` | Id extraction, slugging, emoji strip |

Bundled output: `dist/notion-importer/` (run `bun run build` in the package after meaningful changes if using the bundle).

When implementation and this doc disagree, treat **this doc as authoritative** until one is updated explicitly.

## Obsidian (optional)

- Open `content/` as the vault root (or symlink into a larger vault).
- Front matter `title` and `aliases` support Quick Switcher and graph; relative `[text](note.md)` links are the single source of truth — wikilink-only format is not required.

## See also

- [rippledoc.md](./rippledoc.md) — content watcher (separate from import)
- [`packages/notion-importer/AGENTS.md`](../../packages/notion-importer/AGENTS.md) — run, test, dev notes
- [`AGENTS.md`](../../AGENTS.md) — repo router and conventions
