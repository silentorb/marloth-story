# Marloth database

## Summary

The Marloth design corpus is a **git-tracked flat content store** under `content/` (markdown nodes + JSON for edges and dynamic-field config). Implementation lives in `packages/marloth-db`. **`content/` is the canonical store**; `data/marloth.sqlite` is a **local, gitignored query cache** rebuilt from content. A legacy Notion import pipeline (`packages/notion-importer`) populated the initial graph; use `bun run content:export` to migrate an old SQLite file into `content/` (see [notion-import.md](./notion-import.md)).

## When to read this

Read this doc when your task involves:

- `data/marloth.sqlite` or the `./data/` directory
- `packages/marloth-db/` schema, graph API, or queries
- Modeling nodes, relationships, labels, or properties
- Editing or migrating graph data in place (not via full re-import)
- Extending the graph schema or API

For **what design nodes mean** (features, inspirations, products, traceability), read [`../ontology.md`](../ontology.md) alongside this doc.

## Terminology (post-migration)

| Term | Meaning |
| --- | --- |
| **Node** | Entity in `nodes` (replaces *vertex* / *record* in API and docs). |
| **Relationship** | Directed labeled link in `relationships` (replaces *edge*). |
| **Page** | Editor-facing node view (`getNodePageDetail`, `NodePageView`)—not a Notion export file. |
| **Type table** | Node that receives `IS_A` rows and/or carries table schema metadata (`notion_schema`, etc.). Any node may act as a type when the graph uses it that way. |
| **Schema** | Relationship rules in `content/schema.json` — see [schema.md](./schema.md). |

API names: `ContentStore`, `openMarlothWriteContext`, `getNodeDetail`, `getNodePageDetail`, `GET /api/nodes`, `marloth://node/{id}`, standalone `?node=`. Cache tables: `nodes`, `relationships` (`SCHEMA_VERSION` **6**).

## Editing the graph (agent workflow)

**Default:** change files under `content/`.

- Use `ContentStore` / `MarlothWriteContext` (via editor API or `openMarlothWriteContext`), or edit `content/{id}.md` and `content/relationships.json` directly.
- Commit changes under `content/`; do not commit `data/marloth.sqlite`.
- Run `bun run content:sync` after bulk file edits if the editor API is not running (otherwise the file watcher syncs automatically).
- **Do not** modify `packages/notion-importer` and run `bun run notion:import` / `--clean` for routine work.

**When data exists only in `./exports/`:** read the relevant Notion `.md` or `.csv` from the archival export and apply **targeted** upserts using the same mapping rules as the legacy importer (pages → nodes, relations → relationships, CSV rows → `IS_A`, etc.). Reuse importer parsing helpers if helpful; do not run a full-graph rebuild.

**Schema changes:** bump `SCHEMA_VERSION` in `schema.ts`, migrate existing rows in place, document steps here or in commit notes. Re-import is not a migration strategy.

## Requirements

### Storage

| Path | Role |
| --- | --- |
| `content/{nodeId}.md` | Canonical node (YAML frontmatter + markdown body) |
| `content/relationships.json` | Canonical directed relationships |
| `content/dynamic-fields.json` | Dynamic table field bindings |
| `content/schema.json` | Relationship rules (allowed target types) |
| `data/marloth.sqlite` | Local query cache (gitignored; default path via `MARLOTH_DB_PATH`) |

- `content/` **must** remain a **flat** directory (only files, no subfolders).
- Node filenames **must** match `^[0-9a-f]{32}\.md$`.
- SQLite WAL sidecar files (`*.sqlite-wal`, `*.sqlite-shm`) **must not** be committed.

### Property graph model

The database **must** model a **property graph**:

| Element | Table(s) | Semantics |
| --- | --- | --- |
| Node | `nodes` | Entity with a JSON property bag |
| Relationship | `relationships` | Directed relationship with a label and JSON properties |
| Metadata | `meta` | Schema version, import timestamps, etc. |

Type-table behavior is inferred from `IS_A` usage and schema metadata (`isTypeTableNode` in `node-capabilities.ts`), not node labels.

- Node ids **must** be stable text keys (Notion pages use 32-hex ids).
- Relationship ids **must** be deterministic: `{source_id}:{label}:{target_id}`.
- Relationship labels **must** be uppercase slug forms derived from Notion relation property names (e.g. `Scenes` → `SCENES`).

### Notion mapping (legacy initial import)

| Notion concept | Graph representation |
| --- | --- |
| Page (`.md`) | Node with scalar properties in JSON; markdown body in `body` |
| Page relation property | Relationship from page to related page; label from property name |
| Database (CSV export) | Node with `notion_database` / synced `notion_schema` |
| Database row / type instance | Relationship `(page)-[:IS_A {view, row_index, …columns}]->(type)`; Name/title lives on the page node only |
| CSV relation column | Relationship from row's page to targets |

- Relation targets missing from the export **may** be created as stub page nodes (title only) so the graph stays connected.
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

- `upsertNode(id, properties)` — create or merge node
- `upsertRelationship(sourceId, targetId, label, properties)` — create or merge relationship
- `getNodeDetail` / `getNodePageDetail` — inspection; the latter adds **metadata** (timestamps, relationship count, markdown backlinks) and ordered **sections** (markdown, database table, relation tables)
- `getDatabaseViewDetail` — database row table for a type-table node; uses synced `notion_views` / `notion_schema` when present (see [notion-metadata-sync.md](./notion-metadata-sync.md)). **Scalar** columns (select, number, formula snapshots, etc.) come from `IS_A` relationship properties; **relation** columns are hydrated at read time from outgoing relationships whose label matches the property (prefer `via_database` = this database, else unscoped relationships on that label). Bulk CSV re-import is legacy — see [notion-import.md](./notion-import.md).
- `finalize()` — `PRAGMA optimize` + `VACUUM` for compact storage
- Constructor `{ clean: true }` — delete existing file before open

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `content/` | Canonical property graph (flat files) |
| `data/marloth.sqlite` | Local query cache |
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
| Cache database path | `--db <path>` | `MARLOTH_DB_PATH` | `data/marloth.sqlite` |

See [notion-import.md](./notion-import.md) for archival export layout (mining only).

## Verification

- **Unit tests:** `bun test` in `packages/marloth-db/`.
- **After content edits:** `bun run content:sync` or use the editor API; spot-check via `getNodeDetail` or the editor.
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
| `packages/marloth-db/src/node-metadata.ts` | Page metadata (timestamps, relationships, markdown backlinks) |
| `packages/marloth-db/src/notion-database-schema.ts` | Parsed Notion database schema/view JSON on nodes |
| `packages/marloth-db/src/notion-view-eval.ts` | Notion view filter/sort evaluation for database tables |
| `packages/marloth-db/src/database-view.ts` | Type instance table reconstruction from incoming `IS_A` relationships |
| `packages/marloth-db/src/database-view-relations.ts` | Relation-column hydration for database table views |
| `packages/marloth-db/src/node-capabilities.ts` | Type-table detection, graph groups, type lookup |
| `packages/marloth-db/src/schema-rules/` | Load and resolve `content/schema.json` |
| `packages/marloth-db/src/ordered-associations.ts` | Ordered association config, view query, move mutation |
| `packages/notion-importer/src/graph-pipeline.ts` | Notion → graph import |
| `packages/notion-importer/src/relations.ts` | Parse Notion relation link syntax |

## See also

- [schema.md](./schema.md) — relationship rules in `content/schema.json`
- [graph-explorer.md](./graph-explorer.md) — anchor-scoped LOD graph visualization
- [notion-metadata-sync.md](./notion-metadata-sync.md) — read-only Notion API sync for timestamps and database views
- [notion-import.md](./notion-import.md) — export resolution and import pipeline
- [ordered-associations.md](./ordered-associations.md) — automatic sequence for associations (scenes-first)
- [`../ontology.md`](../ontology.md) — design domain model (storage-agnostic)
- [`packages/marloth-db/AGENTS.md`](../../packages/marloth-db/AGENTS.md)
- [`AGENTS.md`](../../AGENTS.md) — project purpose, terminology, modeling direction

## Future expansion

- **Multi-dimensional slicing** — product is one axis today; expect additional dimensions (arc, medium, audience, etc.) as labels, properties, or relationships.
- **Weighted relationships** — e.g. feature↔inspiration strength as a numeric relationship property rather than a boolean link. Not implemented yet; current import creates unweighted relationships only.
