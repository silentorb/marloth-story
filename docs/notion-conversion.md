# Notion export → `content/` markdown

This document describes how narrative and database content from the Notion export in `external/notion/` is transformed into a **flat** corpus of cross-linked markdown files under `content/`, plus machine-readable metadata for tooling and AI.

## Re-running the import

From the repository root (after Python 3 is available):

```bash
python3 -m scripts.notion_to_content
```

To replace all generated `content/*.md` notes in one go:

```bash
python3 -m scripts.notion_to_content --clean
```

- **Inputs**: all `*.md` and `*.csv` under `external/notion/`.
- **Outputs**:
  - `content/*.md` — one file per exported page, plus one index file per database CSV view.
  - `docs/notion-import-manifest.json` — per-file `notion_id`, `source_export`, `output`, and index metadata.
  - `docs/notion-link-report.txt` — unresolved Notion-style `Label (path)` links during the rewrite pass.
  - `docs/notion-link-check.txt` — relative `[label](...)` targets in `content/` that do not exist (post-import sanity check).

The pipeline is **idempotent**: same export tree should yield the same logical output, which helps when tuning parsers or re-importing.

## Design: why everything is in one `content/` folder

- **No per-table or per-plot subdirectories.** Every emitted markdown file lives directly under `content/`. The stable identity of a row is the **32-hex Notion id** in the filename and in YAML front matter, not its former folder in the export. Original Notion **export** files under `external/notion/` keep the exporter’s names; **emitted** names in `content/` are URL-friendly (see below).
- **Navigation** is meant to work via **search**, **generated index tables**, the **manifest**, and **AI** over the corpus—rather than browsing a deep tree.
- **Rationale:** experiment with a flat vault-style corpus. If a future split by table or topic is needed, the manifest and ids make that a mechanical follow-on.

**GitHub** will show a long single directory listing; that is an accepted trade-off for this layout.

## Filenames and titles

- **Source** (under `external/notion/`): Notion’s usual `{title} {32-hex id}.md` pattern is unchanged and is what `source_export` points at.
- **Output** (under `content/`): `{url-slug}-{32-hex id}.md` — all **lowercase**, **spaces** become **hyphens**, **apostrophes** are removed, other punctuation is folded to hyphens (with runs collapsed), and letters are **ASCII slug**-style (Unicode letters are normalized, combining marks stripped). If nothing readable remains in the title segment, the stub `page` is used before the id.
- The **human title** is in the file: YAML `title` and the leading `#` heading (when present), not only in the filename.

## Index files (per database view from CSV)

For each `*.csv` that matches the usual Notion database export naming (`Name {database_id}.csv`, `Name {id}_all.csv`, `Name {id}_all_1.csv`, etc.), the tool emits **one** markdown file with:

- **Minimal front matter**: `type: notion-index`, `view`, `source_export` (path to the CSV), optional `notion_database` (the 32-hex id from the filename when parseable).
- A **GitHub Flavored Markdown table** whose headers are the CSV column names with **emojis removed**; duplicate names after stripping get deterministic suffixes.

**Naming** (peers in `content/`):

- `index-{database_id}-{view}.md` when the CSV basename is parseable (e.g. `index-4e973268d3474f71bd7992094fb39663-all.md`). Database and view keys are lowercased; underscores in a view key become hyphens.
- If a collision would occur, a short hash segment is appended: `index-{db}-{view}-{hash}.md`.
- Unparseable CSV basenames get a name like `index-{hash}-unparsed.md` derived from a hash of the source path (still under `content/`).

Links in table cells that look like Notion `Label (path.md)` or `Label (path.csv)` are rewritten to point at the **flat** `content/` target (the row’s `.md` or the **generated** index for that `.csv`).

## Link rewriting

- **Canonical navigation** uses **path-relative** markdown links in the same directory, e.g. `[Label](my-page-title-<notion-id>.md)` (often unquoted because names are URL-friendly), so they work in local editors, GitHub preview, and Obsidian.
- The pipeline:
  1. Resolves Notion’s `Label (../relative/path%20to%20File%20{id}.md)` and `.csv` forms using the **resolved path** in the export.
  2. Maps **.csv** paths to the **index** file generated for that CSV (same as linking to a “view” of the database).
  3. If the path does not match (export quirks), falls back to the **32-hex id** in the path to find the target `content/` file.
- **Not** the primary design: `https://github.com/.../blob/...` links for everyday navigation (they break offline and across branches). Prefer relative links.

Some links will still be **missing** after import: the export can reference **deleted** pages, **stale** ids, or rows that exist only in CSV and never had a matching `.md`. See `docs/notion-link-check.txt` and the link report; fixes can be made in a **config/override** layer in a future iteration or by correcting the source in Notion and re-exporting.

## Property names and emojis

Notion often prefixes property names with emojis. In **all generated tables and YAML keys**, emojis are **stripped** from those names so diffs, search, and front matter stay tool-friendly. **Values** (including prose and relation lists) are not altered for emoji unless they are clearly property **labels** at the start of a line; relation lines in the body are label-stripped the same way.

## YAML front matter (imported pages)

Each **content** note under `content/` (not the `notion-index` files, except as noted for indexes above) is emitted with a leading block, for example:

```yaml
---
title: "…"
notion_id: "…"
aliases:
  - "…"
source_export: "external/notion/…"
inferred_notion_path: "…"
# optional scalar properties promoted from lines like "Order: 1" (keys slugified, emoji-stripped)
---
```

- **`title`**: from the first `#` heading, or from parsing rules when the heading is empty.
- **`notion_id`**: 32-hex id from the source filename.
- **`aliases`**: at least a short form suitable for Obsidian (e.g. title with trailing ` {id}` removed when it matches the id).
- **`source_export`**: repository-relative path to the **original** exported `.md`.
- **`inferred_notion_path`**: parent path inside the export (under `external/notion/`), for logical grouping in tools.
- **Scalars** that appear as `Name: value` before the main body are promoted into the front matter with **slugified, emoji-stripped** keys. If a key would collide with reserved names (`title`, `notion_id`, …), it is prefixed (e.g. `prop_…`).

**Large relation fields** (long comma-separated `Label (path)` lists) may remain in the **body** under `##` sections, with link rewriting applied—so the readable structure is preserved without stuffing huge lists into YAML.

## Manifest (`docs/notion-import-manifest.json`)

The manifest lists each output filename under `content/` with:

- `notion_id` (where applicable),
- `source_export`,
- `output` (`content/...`),
- `inferred_notion_path` (for page rows when present),
- for index files: `type: "notion-index"`, `notion_database` when known.

This is the primary hook for **filtering** (“all rows from a given database id”), **future vector stores**, and **watches** without relying on directory structure.

## Obsidian (optional)

- Open **`content/`** as the vault root (or symlink it into a larger vault) for a standard Markdown + relative-link experience.
- Front matter may include `title` and `aliases` for the Quick Switcher and graph; **no** wikilink-only format is required for GitHub compatibility—relative `[text](Note.md)` links are the single source of truth.

## See also

- `scripts/notion_to_content/` — import implementation.
- `AGENTS.md` — workspace context for agents.
