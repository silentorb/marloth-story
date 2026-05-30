# Schema (relationship rules)

## Summary

Git-tracked [`content/schema.json`](../../content/schema.json) declares optional **relationship rules**: allowed target types for outgoing relationship labels on nodes that belong to a source type (via `IS_A` membership).

This is separate from:

- SQLite DDL (`SCHEMA_VERSION` in `packages/marloth-db/src/schema.ts`)
- Per-node Notion table metadata (`notion_schema`, `notion_views`, `notion_database` on type-table nodes)

## When to read this

Read this doc when your task involves:

- Adding or editing relationship constraints between design types
- UI filtering for link/search targets
- Extending the rule engine (unions, write-time validation)

For graph storage and node mechanics, see [marloth-db.md](./marloth-db.md). For design semantics, see [ontology.md](../ontology.md).

## File format

```json
{
  "version": 1,
  "relationshipRules": [
    {
      "id": "scene-features",
      "sourceTypeId": "<32-hex type node id>",
      "label": "FEATURES",
      "allowedTargetTypeIds": ["<32-hex type node id>"]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `sourceTypeId` | Type node id; rule applies when the source instance has `IS_A` to this id |
| `label` | Outgoing relationship label (uppercase slug) |
| `allowedTargetTypeIds` | Target instances must have `IS_A` to one of these type ids (v1: usually one id; array supports future unions) |

Types are identified by **stable node id**, not import labels. Any node may serve as a type when the graph uses it as an `IS_A` target and/or it carries table schema metadata.

## Enforcement (v1)

**UI only** — no API rejection of invalid relationships yet.

- `GET /api/schema` returns the parsed file
- `GET /api/nodes/search?allowedTypeIds=id1,id2` filters results to nodes whose `IS_A` types intersect the list
- Node page relation sections expose `allowedTargetTypeIds` on each outgoing label section when a rule matches
- Creating a relation row via `POST /api/nodes/:id/relation-rows` auto-adds `IS_A` to the sole allowed type when a rule defines exactly one target type

Future: write-time validation and audit scripts.

## Implementation

| Module | Role |
| --- | --- |
| `packages/marloth-db/src/schema-rules/schema-file.ts` | Parse/serialize `schema.json` |
| `packages/marloth-db/src/schema-rules/load.ts` | Load + cache from content dir |
| `packages/marloth-db/src/schema-rules/resolve.ts` | Match rules to source node + label |
| `packages/marloth-db/src/node-capabilities.ts` | Type-table detection, `IS_A` type ids, graph groups |
| `packages/marloth-db/src/node-page-sections.ts` | Embeds `allowedTargetTypeIds` on relation sections |

Cache invalidates when `content/schema.json` changes (same watcher as other content files).

## See also

- [marloth-db.md](./marloth-db.md)
- [ontology.md](../ontology.md)
- [ordered-associations.md](./ordered-associations.md) — hardcoded ordering config (separate from schema rules)
