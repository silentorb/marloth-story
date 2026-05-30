# Marloth database

## Summary

The Marloth design corpus is a **git-tracked flat content store** under `content/` (markdown nodes + JSON for relationships and dynamic-field config). Implementation lives in `packages/marloth-db`. **`content/` is the canonical store**; `data/marloth.sqlite` is a **local, gitignored query cache** rebuilt from content. A legacy Notion import pipeline (`packages/notion-importer`) populated the initial graph; use `bun run content:export` to migrate an old SQLite file into `content/` (see [notion-import.md](./notion-import.md)).

## When to read this

Read this doc when your task involves:

- `data/marloth.sqlite` or the `./data/` directory
- `packages/marloth-db/` schema, graph API, or queries
- Modeling nodes, relationships, types, or properties
- Editing or migrating graph data in place (not via full re-import)
- Extending the graph schema or API

For **what design nodes mean** (features, inspirations, products, traceability), read [`../ontology.md`](../ontology.md) alongside this doc.

## Terminology (post-migration)

| Term | Meaning |
| --- | --- |
| **Node** | Entity in `nodes` (replaces *vertex* / *record* in API and docs). |
| **Relationship** | Link between two nodes with a **relationship type** and JSON properties. |
| **Relationship type** | Lower snake_case name (e.g. `is_a`, `inspirations_features`, `part`). Bidirectional Notion pairs use a single composite type. |
| **Perspective type** | Local type name used in UI/API from one endpoint (e.g. `inspirations` on a Feature page). Mapped to composite storage types via `relationship-types.json`. |
| **Page** | Editor-facing node view (`getNodePageDetail`, `NodePageView`)—not a Notion export file. |
| **Type table** | Node that receives `is_a` rows and/or carries table schema metadata (`notion_schema`, etc.). |
| **Schema** | Relationship rules in `content/schema.json` — see [schema.md](./schema.md). |

API names: `ContentStore`, `openMarlothWriteContext`, `getNodeDetail`, `getNodePageDetail`, `GET /api/nodes`, `marloth://node/{id}`, standalone `?node=`. Cache tables: `nodes`, `relationship_records`, `relationship_projections` (`SCHEMA_VERSION` **7**).

## Editing the graph (agent workflow)

**Default:** change files under `content/`.

- Use `ContentStore` / `MarlothWriteContext` (via editor API or `openMarlothWriteContext`), or edit `content/{id}.md`, `content/relationships.json`, and `content/relationship-types.json` directly.
- Commit changes under `content/`; do not commit `data/marloth.sqlite`.
- Run `bun run content:sync` after bulk file edits if the editor API is not running (otherwise the file watcher syncs automatically).
- **Do not** modify `packages/notion-importer` and run `bun run notion:import` / `--clean` for routine work.

**When data exists only in `./exports/`:** read the relevant Notion `.md` or `.csv` from the archival export and apply **targeted** upserts using the same mapping rules as the legacy importer (pages → nodes, relations → relationships, CSV rows → `is_a`, etc.). Reuse importer parsing helpers if helpful; do not run a full-graph rebuild.

**Schema changes:** bump `SCHEMA_VERSION` in `schema.ts`, migrate existing rows in place, document steps here or in commit notes. Re-import is not a migration strategy.

## Requirements

### Storage

| Path | Role |
| --- | --- |
| `content/{nodeId}.md` | Canonical node (YAML frontmatter + markdown body) |
| `content/relationships.json` | Canonical bidirectional relationship records (v2) |
| `content/relationship-types.json` | Composite type → perspective mapping |
| `content/dynamic-fields.json` | Dynamic table field bindings |
| `content/schema.json` | Relationship rules (allowed target types) |
| `data/marloth.sqlite` | Local query cache (gitignored; default path via `MARLOTH_DB_PATH`) |

- `content/` **must** remain a **flat** directory (only files, no subfolders).
- Node filenames **must** match `^[0-9a-f]{32}\.md$`.
- SQLite WAL sidecar files (`*.sqlite-wal`, `*.sqlite-shm`) **must not** be committed.

### Property graph model

**Content (canonical, compact):** one record per logical link:

```json
{ "a": "<32-hex>", "b": "<32-hex>", "type": "inspirations_features", "properties": { } }
```

- Endpoints `a` / `b` are sorted lexicographically (`a` < `b`).
- **Directed** types (e.g. `is_a`) include `directedFrom` (source node id).
- **Bidirectional** pairs use composite types (e.g. `scenes_part`, `inspirations_features`).
- Record id: `{a}:{b}:{type}`.

**SQLite cache (denormalized):** expanded on sync for fast directed queries:

| Table | Role |
| --- | --- |
| `relationship_records` | Mirror of content records |
| `relationship_projections` | Directed rows `(source, target, local_type)` — hot path for queries |
| `nodes` | Entity property bags |
| `meta` | Schema version, content mtime |

Type-table behavior is inferred from `is_a` usage and schema metadata (`isTypeTableNode` in `node-capabilities.ts`).

- Node ids **must** be stable text keys (Notion pages use 32-hex ids).
- Projection ids **must** be deterministic: `{source_id}:{type}:{target_id}` (local perspective type).
- Relationship types **must** be lower snake_case (e.g. `scenes` → `scenes`, not `SCENES`).

### Notion mapping (legacy initial import)

| Notion concept | Graph representation |
| --- | --- |
| Page (`.md`) | Node with scalar properties in JSON; markdown body in `body` |
| Page relation property | Bidirectional or directed relationship; composite type when both sides were imported |
| Database (CSV export) | Node with `notion_database` / synced `notion_schema` |
| Database row / type instance | Relationship `(page)-[:is_a {view, row_index, …}]->(type)` |
| CSV relation column | Relationship from row's page to targets |

Consolidate legacy dual directed edges with `bun scripts/consolidate-relationships.ts` (already run on the corpus).

### Schema versioning

- `meta.schema_version` **must** record the graph DDL version (`packages/marloth-db/src/schema.ts`).
- Breaking schema changes **must** bump `SCHEMA_VERSION` and document migration steps.

## Behavior / API

`GraphDatabase` (`packages/marloth-db/src/graph.ts`):

- `upsertNode(id, properties)` — create or merge node
- `listRelationshipsFromSource` / `listRelationshipsToTarget` — query projection table by local perspective type
- `getNodeDetail` / `getNodePageDetail` — inspection; the latter adds **metadata** and ordered **sections** (markdown, database table, relation tables)
- `getDatabaseViewDetail` — database row table for a type-table node
- `finalize()` — `PRAGMA optimize` + `VACUUM`
- Constructor `{ clean: true }` — delete existing file before open

Writes go to `content/` via `ContentStore`; sync expands to SQLite projections.

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `content/` | Canonical property graph (flat files) |
| `data/marloth.sqlite` | Local query cache |
| `scripts/consolidate-relationships.ts` | One-time / re-run migration v1 → v2 relationships |
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
| Content directory | — | `MARLOTH_CONTENT_PATH` | `{repo}/content` |
| Cache database path | — | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |

See [notion-import.md](./notion-import.md) for archival export layout (mining only).

## Verification

- **Unit tests:** `bun test` in `packages/marloth-db/`.
- **After content edits:** `bun run content:sync` or use the editor API; spot-check via `getNodeDetail` or the editor.
- **Legacy import only:** `docs/notion-import-manifest.json` and `docs/notion-link-report.txt` (importer tests in `packages/notion-importer/`).

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-db/src/schema.ts` | DDL and version |
| `packages/marloth-db/src/graph.ts` | GraphDatabase API (reads projections) |
| `packages/marloth-db/src/content/relationships-file.ts` | v2 `relationships.json` parse/serialize |
| `packages/marloth-db/src/content/relationship-types-file.ts` | `relationship-types.json` + composite helpers |
| `packages/marloth-db/src/content/relationship-sync-expand.ts` | Content → SQLite projection expansion |
| `packages/marloth-db/src/content/sync.ts` | Cache rebuild and file watcher |
| `packages/marloth-db/src/graph-export.ts` | Full graph and Graph Explorer LOD export |
| `packages/marloth-db/src/node-page-sections.ts` | Universal page sections |
| `packages/marloth-db/src/database-view-relations.ts` | Relation-column hydration |
| `packages/marloth-db/src/ordered-associations.ts` | Ordered association config, view query, move mutation |
| `packages/notion-importer/src/graph-pipeline.ts` | Notion → graph import (legacy) |

## See also

- [schema.md](./schema.md) — relationship rules in `content/schema.json`
- [graph-explorer.md](./graph-explorer.md) — anchor-scoped LOD graph visualization
- [ordered-associations.md](./ordered-associations.md) — automatic sequence for associations (scenes-first)
- [`../ontology.md`](../ontology.md) — design domain model (storage-agnostic)
- [`packages/marloth-db/AGENTS.md`](../../packages/marloth-db/AGENTS.md)
- [`AGENTS.md`](../../AGENTS.md) — project purpose, terminology, modeling direction

## Future expansion

- **Multi-dimensional slicing** — product is one axis today; expect additional dimensions (arc, medium, audience, etc.) as types, properties, or relationships.
- **Weighted relationships** — e.g. feature↔inspiration strength as a numeric relationship property rather than a boolean link.
