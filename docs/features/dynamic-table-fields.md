# Dynamic table fields

## Summary

**Dynamic table fields** are database view columns computed at read time from graph traversals. Logic is documented authoritatively in [`docs/dynamic-fields/`](../dynamic-fields/); runtime bindings live in dedicated overlay SQLite tables that can be dropped and rebuilt without affecting core graph tables (`vertices`, `edges`, `vertex_labels`, `meta`).

## When to read this

Read this doc when your task involves:

- Computed/formula/rollup columns in database table views
- Overlay tables `dynamic_fields`, `dynamic_column_sets`, etc.
- `packages/marloth-db/src/dynamic-fields/`
- Adding or changing dynamic field resolvers

For per-field logic, read the spec in [`docs/dynamic-fields/`](../dynamic-fields/README.md). For graph storage, read [marloth-db.md](./marloth-db.md). For editor table rendering, read [marloth-editor.md](./marloth-editor.md).

## Requirements

### Core model

- Dynamic values **must** be computed in `marloth-db` when building `DatabaseViewDetail`, before Notion view filter/sort evaluation.
- Dynamic values **must** override stale `IS_A` edge properties when column keys match.
- Core graph tables **must not** store dynamic field configuration; overlay tables only.
- Each dynamic field **must** have an authoritative spec under `docs/dynamic-fields/`.
- Resolvers **must** be registered in TypeScript (`resolver_id` → function); overlay rows reference resolver ids and params only.

### Overlay tables

- Overlay DDL **must** live in `packages/marloth-db/src/schema.ts` (SCHEMA_VERSION ≥ 2).
- Tables: `dynamic_fields`, `dynamic_field_params`, `dynamic_field_view_bindings`, `dynamic_column_sets`, `dynamic_column_set_params`.
- Dropping all `dynamic_*` tables **must** leave the property graph intact.

### Column kinds

| Kind | Overlay table | Behavior |
| --- | --- | --- |
| Fixed | `dynamic_fields` | One column key per field (e.g. `all_scene_count`) |
| Dimension-expanded | `dynamic_column_sets` | Pattern generates columns per dimension value (e.g. per Product) |

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
4. Seed overlay via `scripts/seed-dynamic-fields.ts`.
5. Add tests in `packages/marloth-db/src/dynamic-fields/`.
6. Run graph migration scripts if new edges are required (e.g. `scripts/migrate-theme-edges.ts`).

No manual UI for field configuration in v1.

## Design rationale

### Docs as source of truth

Agents implement and reimplement resolvers from field specs. Overlay config is bindings only; semantics live in docs.

### Overlay vs core graph

Separating configuration lets the overlay be rebuilt without touching imported design data. Theme associations (e.g. `THEME → Wonderland`) live in core edges because they are design relationships, not field config.

### Hybrid execution

Pure config DSLs are insufficient for graph traversals and dimension expansion. TypeScript resolvers provide power; overlay tables avoid hard-coding database/column bindings in code.

## Behavior / pipeline

```
getDatabaseViewDetail(db, databaseId, view)
  → build EvalRow[] from IS_A edges
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
| `data/marloth.sqlite` (`dynamic_*` tables) | Runtime bindings |
| `packages/marloth-db/src/dynamic-fields/` | Resolver registry and enrichment |
| `scripts/seed-dynamic-fields.ts` | Seed overlay configuration |
| `scripts/migrate-theme-edges.ts` | Create THEME edges from legacy tags |

## Quick start

```bash
# Migrate theme edges (core graph, one-time)
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
