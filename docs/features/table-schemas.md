# Table schemas (`table-schemas.json`)

## Summary

Type-table column definitions live in [`content/model/table-schemas.json`](../../content/model/table-schemas.json). Each entry is keyed by the **type-table node id** (32-hex). The editor and `marloth-db` table views read columns from this file—not from node frontmatter.

## When to read this

- Adding or editing database table columns (select, relation, checkbox, etc.)
- Understanding how `is_a` row properties map to UI columns
- Migrating or auditing type tables after the Notion schema migration

See also [marloth-db.md](./marloth-db.md), [views.md](./views.md), and [schema.md](./schema.md).

## File shape (v1)

```json
{
  "version": 1,
  "tables": {
    "dd0de9867cc345b898929306bdf9fc83": {
      "columns": [
        { "key": "priority", "name": "Priority", "type": "select", "enumId": "priority" },
        {
          "key": "inspirations",
          "name": "Inspirations",
          "type": "relation",
          "targetTypeId": "2eea538996934ce8abafc27132e576c1",
          "perspective": "inspirations"
        }
      ]
    }
  }
}
```

## Column rules

| Rule | Detail |
| --- | --- |
| **Identity** | Column identity is `key` (slug), not Notion property ids |
| **Scalars** | `select`, `multi_select`, `checkbox`, `number`, `text`, `date`, `url`, `email`, `phone_number` |
| **Relations** | `targetTypeId` is a graph node id; `perspective` maps to [`relationship-types.json`](../../content/model/relationship-types.json) |
| **Enums** | `enumId` references [`schema.json`](../../content/model/schema.json) `enums` |
| **Computed** | Formula/rollup columns are **not** stored here; use [`dynamic-fields.json`](./dynamic-table-fields.md) |

## Type table detection

A node is a **type table** when:

1. Its id appears in `table-schemas.json`, **or**
2. It has incoming `is_a` edges (legacy heuristic for tables without explicit schema entries)

Row data for instances is stored on `is_a` relationship properties, not on the instance node vertex.

## Editing

- **Manual:** edit `table-schemas.json` directly (validate with `bun run validate:content-model`)
- **Editor:** column delete via API mutates `table-schemas.json` through `ContentStore`
- **Sync:** `bun run content:sync` or editor API startup rebuilds the SQLite cache

## Migration

One-time migration from `notion_schema` frontmatter: `bun scripts/migrate-notion-schema-to-table-schemas.ts` (already run on the corpus). Legacy provenance keys are stripped by `bun scripts/strip-notion-provenance.ts`.
