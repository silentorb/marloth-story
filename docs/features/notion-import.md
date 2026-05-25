# Notion import

## Summary

The Notion import feature transforms narrative and database content from a Notion export into a **SQLite property graph** at `data/marloth.sqlite`, plus machine-readable metadata under `docs/` for tooling and AI. Implementation lives in `packages/notion-importer`; graph storage in `packages/marloth-db`.

## When to read this

Read this doc when your task involves:

- Notion export → graph import or re-import
- `packages/notion-importer/`, or `./exports/`
- Import manifest or unresolved relation reports
- Changing Notion → graph mapping conventions

For graph schema, storage, and query API, see [marloth-db.md](./marloth-db.md).

## Requirements

### Source resolution

- The pipeline **must** accept a directory or `.zip` export path via `--source` or `NOTION_EXPORT_DIR`.
- By default, the pipeline **must** prefer the most recently modified entry in `./exports/`.
- If `./exports/` is empty or missing (and no `--source` / `NOTION_EXPORT_DIR`), the pipeline **must** fail with a clear error.
- Zip sources **must** be extracted to a temporary directory for the run. Nested part archives (e.g. `ExportBlock-…-Part-1.zip`) **must** be unpacked recursively until only pages and CSVs remain.

### Output

- The pipeline **must** write the property graph to `data/marloth.sqlite` by default (`--db` / `MARLOTH_DB_PATH` to override).
- Stable row identity **must** be the **32-hex Notion id** as the vertex id for pages.
- Export archives under `./exports/` **must** keep Notion exporter names; vertex `source_export` records the repo-relative path.

### Page import

Each Notion page (`.md`) **must** become a vertex labeled `NotionPage` with properties including at minimum:

- `title` — from first `#` heading
- `notion_id` — 32-hex id from source filename
- `source_export` — repo-relative path to exported `.md`
- `inferred_notion_path` — parent path inside export, when under `exports/`
- `body` — markdown body (relation property lines removed; converted to edges)
- `alias` — short title without trailing id suffix
- Scalar `Key: value` lines before the body **must** be stored as slugified, emoji-stripped property keys

### Relations

- Notion relation properties (`Label (path.md)` lists) **must** become directed edges to target page vertices.
- Edge labels **must** be uppercase slug forms of the property name (emoji stripped).
- Ordered relation lists **should** store `ordinal` on the edge.

### Database CSV import

For each `*.csv` matching Notion database export naming (`Name {database_id}.csv`, `Name {id}_all.csv`, etc.):

- Emit a `NotionDatabase` vertex keyed by `database_id`.
- Each row with a linked Name **must** create an `IS_A` edge from the page to the type (database), carrying scalar column values as edge properties (not on the page vertex).
- Rows without a resolvable page **must** create a stub `NotionPage` and an `IS_A` edge (deterministic orphan id); do not store row payloads on the database vertex.
- Relation columns **must** become edges from the row's page to targets.

### Manifest and reports

- The pipeline **must** write `docs/notion-import-manifest.json` with vertex index, database views, and counts.
- The pipeline **must** write `docs/notion-link-report.txt` for unresolved relation paths.
- The pipeline **must** be **idempotent**: the same export tree yields the same logical graph.

### Clean mode

- With `--clean`, the pipeline **must** replace the database file before import (full rebuild).

## Design rationale

### Graph instead of flat markdown

- **Goal:** support richer data modeling (relations, databases, future world-building entities) beyond what Notion or a flat markdown vault could express cleanly.
- **Rejected:** continuing flat `content/*.md` as the primary store — relation-heavy corpus was outgrowing file-based navigation.
- **Trade-off:** no longer optimized for Obsidian-style markdown vault browsing; markdown body remains on vertices for reading/export.

See [marloth-db.md](./marloth-db.md) for graph storage rationale.

### Emoji stripping on names only

- Property **names** (YAML keys, edge labels) **must** have emojis stripped.
- Property **values** **must not** be altered unless they are clearly property labels.

## Behavior / pipeline

High-level stages (see `packages/notion-importer/src/graph-pipeline.ts`):

1. **Resolve source** — pick export dir/zip; extract zips recursively.
2. **Open database** — create schema; optional clean rebuild.
3. **Import pages** — parse each `.md`; upsert `NotionPage` vertices.
4. **Import relations** — parse relation properties; upsert edges (stub targets if needed).
5. **Import CSVs** — upsert `NotionDatabase` vertices; row membership and relation edges.
6. **Write artifacts** — manifest JSON, link report; vacuum database.

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `./exports/` | Notion export drop zone (most recent `.zip` or directory wins) |
| `data/marloth.sqlite` | Property graph output |
| `docs/notion-import-manifest.json` | Import summary |
| `docs/notion-link-report.txt` | Unresolved relation paths |

## Quick start

From the repository root (Bun required):

```bash
# default: uses newest entry in ./exports/
bun run notion:import
```

Full replace of the graph:

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
| Database path | `--db <path>` | `MARLOTH_DB_PATH` |
| Full replace | `--clean` | — |
| Repo root | `--repo <path>` | — |

See `bun run notion:import -- --help` for full flag list.

## Verification

- **Unit tests:** `bun test` from `packages/notion-importer/`.
- **Manifest:** after import, `docs/notion-import-manifest.json` lists expected vertex count.
- **Link report:** inspect `docs/notion-link-report.txt` for broken relation targets.
- **Idempotency:** re-run on the same export; logical graph should not change except for intentional parser updates.

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | CLI entry |
| `src/config.ts` | CLI/env resolution |
| `src/graph-pipeline.ts` | Graph import orchestration |
| `src/relations.ts` | Notion relation link parsing |
| `src/parse.ts` | Page splitting |
| `src/indexes.ts` | CSV parsing |
| `src/ids.ts`, `src/textutil.ts` | Id extraction, slugging, emoji strip |

When implementation and this doc disagree, treat **this doc as authoritative** until one is updated explicitly.

## See also

- [marloth-db.md](./marloth-db.md) — property graph schema and API
- [rippledoc.md](./rippledoc.md) — content watcher (legacy markdown; separate from import)
- [`packages/notion-importer/AGENTS.md`](../../packages/notion-importer/AGENTS.md)
- [`AGENTS.md`](../../AGENTS.md)
