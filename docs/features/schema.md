# Schema (relationship rules)

## Summary

Git-tracked [`content/schema.json`](../../content/schema.json) declares optional **relationship rules**: allowed target types for outgoing relationship **types** (local perspective names) on nodes that belong to a source type (via `is_a` membership).

This is separate from:

- SQLite DDL (`SCHEMA_VERSION` in `packages/marloth-db/src/schema.ts`)
- Per-node Notion table metadata (`notion_schema`, etc.)
- Composite storage types in [`content/relationship-types.json`](../../content/relationship-types.json)

## File format

```json
{
  "version": 1,
  "relationshipRules": [
    {
      "id": "scene-features",
      "sourceTypeId": "<32-hex type node id>",
      "type": "features",
      "allowedTargetTypeIds": ["<32-hex type node id>"]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `sourceTypeId` | Type node id; rule applies when the source instance has `is_a` to this id |
| `type` | Outgoing relationship type (lower snake_case, local perspective) |
| `allowedTargetTypeIds` | Target instances must have `is_a` to one of these type ids |

Types are identified by **stable node id**, not display names.

## Enforcement (v1)

**UI only** — no API rejection of invalid relationships yet.

- `GET /api/schema` returns the parsed file
- `GET /api/nodes/search?allowedTypeIds=id1,id2` filters results to nodes whose `is_a` types intersect the list
- Node page relation sections expose `allowedTargetTypeIds` on each outgoing type section when a rule matches
- Creating a relation row via `POST /api/nodes/:id/relation-rows` auto-adds `is_a` to the sole allowed type when a rule defines exactly one target type

## Implementation

| Module | Role |
| --- | --- |
| `packages/marloth-db/src/schema-rules/schema-file.ts` | Parse/serialize `schema.json` |
| `packages/marloth-db/src/schema-rules/resolve.ts` | Match rules to source node + type |
| `packages/marloth-db/src/node-page-sections.ts` | Embeds `allowedTargetTypeIds` on relation sections |

## See also

- [marloth-db.md](./marloth-db.md)
- [ontology.md](../ontology.md)
- [ordered-associations.md](./ordered-associations.md)
