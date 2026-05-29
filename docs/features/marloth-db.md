# Marloth database

## Summary

The Marloth database is a **git-tracked SQLite property graph** under `data/` that holds story, design, and plot data. Implementation lives in `packages/marloth-db`. **`data/marloth.sqlite` is the canonical store**—agents and tooling edit it directly. A legacy Notion import pipeline (`packages/notion-importer`) populated the initial graph; it is not the ongoing update path (see [notion-import.md](./notion-import.md)).

## When to read this

Read this doc when your task involves:

- `data/marloth.sqlite` or the `./data/` directory
- `packages/marloth-db/` schema, graph API, or queries
- Modeling nodes, connections, labels, or properties
- Editing or migrating graph data in place (not via full re-import)
- Extending the graph schema or API

For **what design nodes mean** (features, inspirations, products, traceability), read [`../ontology.md`](../ontology.md) alongside this doc.

## Terminology (post-migration)

| Term | Meaning |
| --- | --- |
| **Node** | Entity in `nodes` / `node_labels` (replaces *vertex* / *record* in API and docs). |
| **Connection** | Directed labeled link in `connections` (replaces *edge*). |
| **Page** | Editor-facing node view (`getNodePageDetail`, `NodePageView`)—not a Notion export file. |
| **NotionPage** / **NotionDatabase** | Legacy **import labels**; keep when describing Notion mapping or stored label values. |

API names: `upsertNode`, `upsertConnection`, `getNodeDetail`, `getNodePageDetail`, `GET /api/nodes`, `marloth://node/{id}`, standalone `?node=`. SQLite core tables: `nodes`, `node_labels`, `connections` (`SCHEMA_VERSION` **3**).

## Editing the graph (agent workflow)

**Default:** change `data/marloth.sqlite` in place.

- Use `GraphDatabase` (`upsertNode`, `upsertConnection`, ordered-association helpers, etc.), the marloth editor, or a **focused** Bun script/SQL migration that opens the existing file (no `{ clean: true }` unless intentionally replacing an empty dev copy).
- Commit the updated `marloth.sqlite` with related code/docs changes.
- **Do not** modify `packages/notion-importer` and run `bun run notion:import` / `--clean` to apply routine data or schema work.

**When data exists only in `./exports/`:** read the relevant Notion `.md` or `.csv` from the archival export and apply **targeted** upserts using the same mapping rules as the legacy importer (page → `NotionPage`, relations → connections, CSV rows → `IS_A`, etc.). Reuse importer parsing helpers if helpful; do not run a full-graph rebuild.

**Schema changes:** bump `SCHEMA_VERSION` in `schema.ts`, migrate existing rows in place, document steps here or in commit notes. Re-import is not a migration strategy.

## Requirements

### Storage

- The canonical database file **must** live at `data/marloth.sqlite` by default (override via `--db` / `MARLOTH_DB_PATH`).
- The database file **must** be suitable for git tracking: writers **should** call `GraphDatabase.finalize()` (`PRAGMA optimize` + `VACUUM`) before commits when compacting matters; legacy full imports also vacuum for determinism.
- SQLite WAL sidecar files (`*.sqlite-wal`, `*.sqlite-shm`) **must not** be committed.

### Property graph model

The database **must** model a **labeled property graph**:

| Element | Table(s) | Semantics |
| --- | --- | --- |
| Node | `nodes`, `node_labels` | Entity with one or more labels and a JSON property bag |
| Connection | `connections` | Directed relationship with a label and JSON properties |
| Metadata | `meta` | Schema version, import timestamps, etc. |

- Node ids **must** be stable text keys (Notion pages use 32-hex ids).
- Connection ids **must** be deterministic: `{source_id}:{label}:{target_id}`.
- Connection labels **must** be uppercase slug forms derived from Notion relation property names (e.g. `Scenes` → `SCENES`).

### Notion mapping (legacy initial import)

| Notion concept | Graph representation |
| --- | --- |
| Page (`.md`) | Node labeled `NotionPage`; scalar properties in JSON; markdown body in `body` |
| Page relation property | Connection from page to related page; label from property name |
| Database (CSV export) | Node labeled `NotionDatabase` |
| Database row / type instance | Connection `(page)-[:IS_A {view, row_index, …columns}]->(type)`; Name/title lives on the page node only |
| CSV relation column | Connection from row's page to targets |

- Relation targets missing from the export **may** be created as stub `NotionPage` nodes (title only) so the graph stays connected.
- Unresolved relation paths **must** be reported in `docs/notion-link-report.txt`.

### Schema versioning

- `meta.schema_version` **must** record the graph DDL version (`packages/marloth-db/src/schema.ts`).
- Breaking schema changes **must** bump `SCHEMA_VERSION` and document migration steps.

## Design rationale

### Property graph in SQLite

- **Goal:** express rich Notion-style relations and future story-world connections (characters, scenes, arcs) naturally, without directory layout or flat-file limits.
- **Rejected:** nested JSON documents only — hides relationship structure and complicates traversal queries.
- **Rejected:** dedicated graph DB server — unnecessary for a single-author local corpus; SQLite is zero-ops and git-friendly.
- **Trade-off:** graph traversals are SQL joins/recursive CTEs rather than native graph queries; acceptable at current scale.

### Git-tracked binary

- **Goal:** one authoritative data artifact versioned with prose and tooling.
- **Trade-off:** diffs are opaque; `docs/notion-import-manifest.json` provides a human-readable import summary.

## Behavior / API

`GraphDatabase` (`packages/marloth-db/src/graph.ts`):

- `upsertNode(id, labels, properties)` — create or merge node
- `upsertConnection(sourceId, targetId, label, properties)` — create or merge connection
- `getNodeDetail` / `getNodePageDetail` — inspection; the latter adds **metadata** (timestamps, connection count, markdown backlinks) and ordered **sections** (markdown, database table, relation tables)
- `getDatabaseViewDetail` — database row table for a `NotionDatabase` node; uses synced `notion_views` / `notion_schema` when present (see [notion-metadata-sync.md](./notion-metadata-sync.md)). **Scalar** columns (select, number, formula snapshots, etc.) come from `IS_A` connection properties; **relation** columns are hydrated at read time from outgoing connections whose label matches the property (prefer `via_database` = this database, else unscoped connections on that label). Bulk CSV re-import is legacy — see [notion-import.md](./notion-import.md).
- `finalize()` — `PRAGMA optimize` + `VACUUM` for compact storage
- Constructor `{ clean: true }` — delete existing file before open

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `data/marloth.sqlite` | Canonical property graph |
| `docs/notion-import-manifest.json` | Import summary (nodes, databases, counts) |
| `docs/notion-link-report.txt` | Unresolved relation paths |

## Quick start

```bash
# Inspect or edit the graph (Bun, from repo root)
bun -e "
import { GraphDatabase } from 'marloth-db';
const db = new GraphDatabase('data/marloth.sqlite');
console.log(db.counts());
db.close();
"
```

Legacy full import from `./exports/` (avoid for routine work): `bun run notion:import -- --clean` — see [notion-import.md](./notion-import.md).

## Configuration

| Setting | CLI | Environment | Default |
| --- | --- | --- | --- |
| Database path | `--db <path>` | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |

See [notion-import.md](./notion-import.md) for archival export layout (mining only).

## Verification

- **Unit tests:** `bun test` in `packages/marloth-db/`.
- **After direct edits:** spot-check affected nodes via `getNodeDetail` / SQL; run `finalize()` when preparing a compact commit.
- **Legacy import only:** `docs/notion-import-manifest.json` and `docs/notion-link-report.txt` (importer tests in `packages/notion-importer/`).

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-db/src/schema.ts` | DDL and version |
| `packages/marloth-db/src/graph.ts` | GraphDatabase API |
| `packages/marloth-db/src/graph-export.ts` | Full graph and Graph Explorer LOD export |
| `packages/marloth-db/src/graph-lod-cluster.ts` | Graph Explorer layer subdivision |
| `packages/marloth-db/src/node-page-sections.ts` | Universal page sections (markdown + relation/database tables) |
| `packages/marloth-db/src/markdown-links.ts` | Parse inline markdown links in bodies (backlink source) |
| `packages/marloth-db/src/node-metadata.ts` | Page metadata (timestamps, connections, markdown backlinks) |
| `packages/marloth-db/src/notion-database-schema.ts` | Parsed Notion database schema/view JSON on nodes |
| `packages/marloth-db/src/notion-view-eval.ts` | Notion view filter/sort evaluation for database tables |
| `packages/marloth-db/src/database-view.ts` | Type instance table reconstruction from incoming `IS_A` connections |
| `packages/marloth-db/src/database-view-relations.ts` | Relation-column hydration for database table views |
| `packages/marloth-db/src/relation-label.ts` | Notion relation property name → connection label |
| `packages/marloth-db/src/ordered-associations.ts` | Ordered association config, view query, move mutation |
| `packages/notion-importer/src/graph-pipeline.ts` | Notion → graph import |
| `packages/notion-importer/src/relations.ts` | Parse Notion relation link syntax |

## See also

- [graph-explorer.md](./graph-explorer.md) — anchor-scoped LOD graph visualization
- [notion-metadata-sync.md](./notion-metadata-sync.md) — read-only Notion API sync for timestamps and database views
- [notion-import.md](./notion-import.md) — export resolution and import pipeline
- [ordered-associations.md](./ordered-associations.md) — automatic sequence for associations (scenes-first)
- [`../ontology.md`](../ontology.md) — design domain model (storage-agnostic)
- [`packages/marloth-db/AGENTS.md`](../../packages/marloth-db/AGENTS.md)
- [`AGENTS.md`](../../AGENTS.md) — project purpose, terminology, modeling direction

## Future expansion

- **Multi-dimensional slicing** — product is one axis today; expect additional dimensions (arc, medium, audience, etc.) as labels, properties, or connections.
- **Weighted relationships** — e.g. feature↔inspiration strength as a numeric connection property rather than a boolean link. Not implemented yet; current import creates unweighted connections only.
