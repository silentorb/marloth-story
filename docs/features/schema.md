# Schema (workspace model config)

## Summary

Git-tracked [`content/model/schema.json`](../../content/model/schema.json) declares optional **workspace model configuration**: relationship rules, property enums, and (in future) additional sections. Only core graph mechanics stay in the editor; labels, enum options, defaults, and per-option numeric values live here.

This is separate from:

- SQLite DDL (`SCHEMA_VERSION` in `packages/marloth-db/src/schema.ts`)
- Per-node Notion table metadata (`notion_schema`, etc.)
- Composite storage types in [`content/model/relationship-types.json`](../../content/model/relationship-types.json)

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
  ],
  "enums": {
    "priority": {
      "options": ["Low", "Medium", "High", "Consideration"],
      "default": "Low",
      "defaultOrder": "desc",
      "values": {
        "Low": 1,
        "Medium": 2,
        "High": 4,
        "Consideration": 0
      }
    }
  }
}
```

### Relationship rules

| Field | Meaning |
| --- | --- |
| `sourceTypeId` | Type node id; rule applies when the source instance has `is_a` to this id |
| `type` | Outgoing relationship type (lower snake_case, local perspective) |
| `allowedTargetTypeIds` | Target instances must have `is_a` to one of these type ids |

Types are identified by **stable node id**, not display names.

### Enums

`enums` is an optional map keyed by **enum id** (e.g. column key `priority`).

| Field | Meaning |
| --- | --- |
| `options` | Allowed labels; **array order defines sort order** (index 0, 1, …) |
| `default` | Label used when the stored value is unset |
| `defaultOrder` | Optional `"asc"` (default) or `"desc"`. Controls **dropdown display order** only; `options` array order remains canonical for storage and table sorting. |
| `values` | Optional map from option label → number; meaning is **consumer-defined** |

**Storage:** `content/data/relationships.json` stores enum properties as **labels** (e.g. `"priority": "Medium"`). The SQLite cache stores the same properties as **integer indices** into `options` (see [marloth-db.md](./marloth-db.md)). Table sorts use **index order**, not `values`.

For `priority`, `values` are interpreted as numeric **weights** by `priorityWeight()` and the [`inspirations.weightedUse`](../../docs/dynamic-fields/inspirations.weighted-use.md) dynamic field only — not for table sorting. Other enums may use `values` differently or omit them when only labels matter for UI dropdowns.

`GET /api/schema` returns the parsed file including `enums`.

## Enforcement (v1)

**UI only** — no API rejection of invalid relationships yet.

- `GET /api/schema` returns the parsed file
- `GET /api/nodes/search?allowedTypeIds=id1,id2` filters results to nodes whose `is_a` types intersect the list
- Node page relation sections expose `allowedTargetTypeIds` on each outgoing type section when a rule matches
- Creating a relation row via `POST /api/nodes/:id/relation-rows` auto-adds `is_a` to the sole allowed type when a rule defines exactly one target type
- Priority columns are enriched from `enums.priority` (`options`, `default`, `defaultOrder` on column defs; `values` read by weight consumers)

## Implementation

| Module | Role |
| --- | --- |
| `packages/marloth-db/src/schema-rules/schema-file.ts` | Parse/serialize `schema.json` |
| `packages/marloth-db/src/schema-rules/resolve.ts` | Match rules to source node + type |
| `packages/marloth-db/src/enum-codec.ts` | Label ↔ index encode/decode for SQLite cache |
| `packages/marloth-db/src/enum-config-fingerprint.ts` | Detect enum option-order changes for cache invalidation |
| `packages/marloth-db/src/property-enums.ts` | Resolve enums from schema; priority helpers |
| `packages/marloth-db/src/node-page-sections.ts` | Embeds `allowedTargetTypeIds` on relation sections |

## Future direction

The long-term goal is a **user-configured model**: enums, types, relationship rules, and property shapes editable in content (and eventually via editor UI), while the editor keeps only generic graph and table primitives.

## See also

- [marloth-db.md](./marloth-db.md)
- [ontology.md](../ontology.md)
- [ordered-associations.md](./ordered-associations.md)
- [inspirations.weighted-use.md](../dynamic-fields/inspirations.weighted-use.md)
