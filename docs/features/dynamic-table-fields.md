# Dynamic table fields

## Summary

**Dynamic table fields** are database view columns computed at read time from graph traversals. Logic is documented authoritatively in [`docs/dynamic-fields/`](../dynamic-fields/); runtime bindings live in [`content/dynamic-fields.json`](../../content/dynamic-fields.json) and are loaded into memory at read time (legacy SQLite `dynamic_*` overlay tables were removed in schema v4).

## When to read this

Read this doc when your task involves:

- Computed/formula/rollup columns in database table views
- `content/dynamic-fields.json` bindings
- `packages/marloth-db/src/dynamic-fields/`
- Adding or changing dynamic field resolvers

For per-field logic, read the spec in [`docs/dynamic-fields/`](../dynamic-fields/README.md). For graph storage, read [marloth-db.md](./marloth-db.md). For editor table rendering, read [marloth-editor.md](./marloth-editor.md).

## Requirements

### Core model

- Dynamic values **must** be computed in `marloth-db` when building `DatabaseViewDetail`, before Notion view filter/sort evaluation.
- Dynamic values **must** override stale `IS_A` relationship properties when column keys match.
- Core graph files **must not** store dynamic field configuration; `dynamic-fields.json` only.
- Each dynamic field **must** have an authoritative spec under `docs/dynamic-fields/`.
- Resolvers **must** be registered in TypeScript (`resolver_id` → function); overlay rows reference resolver ids and params only.

### Configuration file

- Bindings **must** live in `content/dynamic-fields.json` (`fields[]` and `columnSets[]`).
- Seed starter bindings: `bun scripts/seed-dynamic-fields.ts`.

### Column kinds

| Kind | JSON section | Behavior |
| --- | --- | --- |
| Fixed | `fields` | One column key per field (e.g. `all_scene_count`) |
| Dimension-expanded | `columnSets` | Pattern generates columns per dimension value (e.g. per Product) |

### Editor integration

- Dynamic fields **must** appear in **database table views** (`DatabaseTableView` / `getDatabaseViewDetail`) and on instance-page **Properties** sections (`buildPropertiesSection` / `PropertiesSectionView`).
- On Properties sections, dynamic values are **read-only**; stored scalars remain editable via the existing database row property API.
- Instance-page Properties use `applyDynamicFields` with all overlay-bound fields for the type database (view-tab bindings ignored).
- Relation table sections **may** gain dynamic columns in a future version.
- `DatabaseColumnDef` **may** include `source: 'dynamic'` for read-only UI styling.

### Agent workflow

1. Write/update `docs/dynamic-fields/<field>.md`.
2. Implement resolver in `packages/marloth-db/src/dynamic-fields/resolvers/`.
3. Register resolver id in `registry.ts`.
4. Update bindings in `content/dynamic-fields.json` (or `bun scripts/seed-dynamic-fields.ts`).
5. Add tests in `packages/marloth-db/src/dynamic-fields/`.
6. Run graph migration scripts if new relationships are required (e.g. `scripts/migrate-theme-edges.ts`).

No manual UI for field configuration in v1.

## Design rationale

### Docs as source of truth

Agents implement and reimplement resolvers from field specs. Overlay config is bindings only; semantics live in docs.

### Overlay vs core graph

Separating configuration lets the overlay be rebuilt without touching imported design data. Theme associations (e.g. `THEME → Wonderland`) live in core relationships because they are design relationships, not field config.

### Hybrid execution

Pure config DSLs are insufficient for graph traversals and dimension expansion. TypeScript resolvers provide power; overlay tables avoid hard-coding database/column bindings in code.

## Behavior / pipeline

```
getDatabaseViewDetail(db, databaseId, view)
  → build EvalRow[] from IS_A relationships
  → applyDynamicFields(db, databaseId, viewName, evalRows)
       load overlay rows for database
       expand dynamic_column_sets → concrete columns
       batch prefetch graph data
       invoke resolvers → merge cells
  → filterEvalRows / sortEvalRows (Notion view)
  → build columnDefs (inject dynamic defs; dynamic wins over stored)
  → DatabaseViewDetail
```

## Inputs / outputs / artifacts

| Path | Role |
| --- | --- |
| `docs/dynamic-fields/*.md` | Authoritative field logic |
| `content/dynamic-fields.json` | Runtime bindings |
| `packages/marloth-db/src/dynamic-fields/` | Resolver registry and enrichment |
| `scripts/seed-dynamic-fields.ts` | Write starter bindings to content |
| `scripts/migrate-theme-edges.ts` | Create THEME relationships from legacy tags |

## Quick start

```bash
# Migrate theme relationships (core graph, one-time)
bun run scripts/migrate-theme-edges.ts

# Seed overlay configuration
bun run scripts/seed-dynamic-fields.ts

# Run tests
cd packages/marloth-db && bun test src/dynamic-fields
```

## Verification

- `bun test` in `packages/marloth-db` — dynamic-fields unit and integration tests
- Open Characters database in editor — `all_scene_count` and per-product columns populated
- Open Inspirations database — `weighted_use` and `wonder` match doc examples

## Implementation pointers

| Component | Path |
| --- | --- |
| Schema / overlay DDL | `packages/marloth-db/src/schema.ts` |
| Overlay read API | `packages/marloth-db/src/dynamic-fields/overlay.ts` |
| Enrichment hook | `packages/marloth-db/src/dynamic-fields/enrich.ts` |
| View integration | `packages/marloth-db/src/database-view.ts` |
| Resolvers | `packages/marloth-db/src/dynamic-fields/resolvers/` |

## See also

- [Dynamic field specs index](../dynamic-fields/README.md)
- [marloth-db.md](./marloth-db.md)
- [marloth-editor.md](./marloth-editor.md)
- [ontology.md](../ontology.md)
