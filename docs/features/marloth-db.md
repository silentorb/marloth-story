# Marloth database

## Summary

The Marloth database is a **git-tracked SQLite property graph** under `data/` that holds story, design, and plot data. Implementation lives in `packages/marloth-db`. Notion exports are imported into this graph by `packages/notion-importer`.

## When to read this

Read this doc when your task involves:

- `data/marloth.sqlite` or the `./data/` directory
- `packages/marloth-db/` schema, graph API, or queries
- Modeling vertices, edges, labels, or properties
- Extending the graph beyond Notion import

For **what design records mean** (features, inspirations, products, traceability), read [`../ontology.md`](../ontology.md) alongside this doc.

## Requirements

### Storage

- The canonical database file **must** live at `data/marloth.sqlite` by default (override via `--db` / `MARLOTH_DB_PATH`).
- The database file **must** be suitable for git tracking: imports **must** run in deterministic order and call `VACUUM` after import.
- SQLite WAL sidecar files (`*.sqlite-wal`, `*.sqlite-shm`) **must not** be committed.

### Property graph model

The database **must** model a **labeled property graph**:

| Element | Table(s) | Semantics |
| --- | --- | --- |
| Vertex | `vertices`, `vertex_labels` | Entity with one or more labels and a JSON property bag |
| Edge | `edges` | Directed relationship with a label and JSON properties |
| Metadata | `meta` | Schema version, import timestamps, etc. |

- Vertex ids **must** be stable text keys (Notion pages use 32-hex ids).
- Edge ids **must** be deterministic: `{source_id}:{label}:{target_id}`.
- Edge labels **must** be uppercase slug forms derived from Notion relation property names (e.g. `Scenes` → `SCENES`).

### Notion mapping (initial import)

| Notion concept | Graph representation |
| --- | --- |
| Page (`.md`) | Vertex labeled `NotionPage`; scalar properties in JSON; markdown body in `body` |
| Page relation property | Edge from page to related page; label from property name |
| Database (CSV export) | Vertex labeled `NotionDatabase` |
| Database row / type instance | Edge `(page)-[:IS_A {view, row_index, …columns}]->(type)`; Name/title lives on the page vertex only |
| CSV relation column | Edge from row's page to target page |

- Relation targets missing from the export **may** be created as stub `NotionPage` vertices (title only) so the graph stays connected.
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

- `upsertVertex(id, labels, properties)` — create or merge vertex
- `upsertEdge(sourceId, targetId, label, properties)` — create or merge edge
- `getRecordDetail` / `getRecordPageDetail` — inspection; the latter adds ordered **sections** (markdown, database table, relation tables)
- `getDatabaseViewDetail` — database row table for a `NotionDatabase` vertex
- `finalize()` — `PRAGMA optimize` + `VACUUM` for compact storage
- Constructor `{ clean: true }` — delete existing file before open

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `data/marloth.sqlite` | Canonical property graph |
| `docs/notion-import-manifest.json` | Import summary (vertices, databases, counts) |
| `docs/notion-link-report.txt` | Unresolved relation paths |

## Quick start

```bash
# Import Notion export into the graph (from repo root)
bun run notion:import -- --clean

# Query example (Bun)
bun -e "
import { GraphDatabase } from 'marloth-db';
const db = new GraphDatabase('data/marloth.sqlite');
console.log(db.counts());
db.close();
"
```

## Configuration

| Setting | CLI | Environment | Default |
| --- | --- | --- | --- |
| Database path | `--db <path>` | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |

See [notion-import.md](./notion-import.md) for export source options.

## Verification

- **Unit tests:** `bun test` in `packages/marloth-db/` and `packages/notion-importer/`.
- **After import:** `docs/notion-import-manifest.json` lists vertex count matching export size; spot-check relations with SQL or `GraphDatabase.getEdge`.

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-db/src/schema.ts` | DDL and version |
| `packages/marloth-db/src/graph.ts` | GraphDatabase API |
| `packages/marloth-db/src/record-sections.ts` | Universal page sections (markdown + relation/database tables) |
| `packages/marloth-db/src/database-view.ts` | Type instance table reconstruction from incoming `IS_A` edges |
| `packages/notion-importer/src/graph-pipeline.ts` | Notion → graph import |
| `packages/notion-importer/src/relations.ts` | Parse Notion relation link syntax |

## See also

- [notion-import.md](./notion-import.md) — export resolution and import pipeline
- [`../ontology.md`](../ontology.md) — design domain model (storage-agnostic)
- [`packages/marloth-db/AGENTS.md`](../../packages/marloth-db/AGENTS.md)
- [`AGENTS.md`](../../AGENTS.md) — project purpose, terminology, modeling direction

## Future expansion

- **Multi-dimensional slicing** — product is one axis today; expect additional dimensions (arc, medium, audience, etc.) as labels, properties, or edges.
- **Weighted relationships** — e.g. feature↔inspiration strength as a numeric edge property rather than a boolean link. Not implemented yet; current import creates unweighted edges only.
