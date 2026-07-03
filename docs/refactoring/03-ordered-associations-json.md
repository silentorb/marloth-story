# Session 03 — Ordered associations JSON config

## Purpose

Move the `scenes-by-book` ordered-association configuration from TypeScript into [`content/model/ordered-associations.json`](../../content/model/ordered-associations.json). Keep the **engine** generic; Marloth domain values live in config only.

## Depends on

[Session 01](./01-workspace-json.md) recommended (loader pattern). No strict dependency on session 02.

## Background

Today:

- Full config is hardcoded as `SCENES_BY_BOOK` in [`packages/tome-db/src/ordered-associations.ts`](../../packages/tome-db/src/ordered-associations.ts)
- [`content/model/views.json`](../../content/model/views.json) only references the provider id for Scenes DB (`204dba198…`):

```json
"tabs": { "kind": "generated", "provider": "scenes-by-book" }
```

See [`docs/features/ordered-associations.md`](../features/ordered-associations.md) for behavior requirements.

## Target schema (v1)

Create `content/model/ordered-associations.json`:

```json
{
  "version": 1,
  "configs": [
    {
      "id": "scenes-by-book",
      "typeDatabaseId": "204dba198db74611b0b49a98dd53e8f5",
      "membershipEdgeType": "is_a",
      "orderProperty": "order",
      "scopeCompositeType": "scenes_product",
      "groupCompositeType": "scenes_part",
      "partProductCompositeType": "products_parts_database",
      "groupTypeDatabaseId": "5e45eefc69a14f45b988ad1f3c9d1ef5",
      "unassignedGroupTitle": "Unassigned",
      "columnViewName": "TWOLD Active",
      "excludedColumnKeys": ["order", "product", "part", "status"],
      "partNumberProperty": "number"
    }
  ]
}
```

### `OrderedAssociationConfig` fields

Must match the interface in `ordered-associations.ts`:

| Field | Description |
| --- | --- |
| `id` | Provider id referenced from `views.json` (`scenes-by-book`) |
| `typeDatabaseId` | Database node whose Items section uses this view |
| `membershipEdgeType` | Usually `is_a` |
| `orderProperty` | Relationship property storing sequence (hidden from UI columns) |
| `scopeCompositeType` | Composite for book/product scope tabs |
| `groupCompositeType` | Composite for part grouping |
| `partProductCompositeType` | Composite linking parts to products |
| `groupTypeDatabaseId` | Parts database node id |
| `unassignedGroupTitle` | Display title for rows with no part |
| `columnViewName` | View name for column visibility (legacy name ok in config) |
| `excludedColumnKeys` | Column keys hidden from ordered-association tables |
| `partNumberProperty` | Parts row property for subsection sort order |

## Implementation steps

### 1. New loader module

`packages/tome-db/src/ordered-associations-config/` (or colocate with existing file):

- `ordered-associations-file.ts` — types, `ORDERED_ASSOCIATIONS_FILE_VERSION`, `parseOrderedAssociationsFile`
- `load.ts` — `loadOrderedAssociationsFromContent`, `invalidateOrderedAssociationsCache`

Paths in [`content/paths.ts`](../../packages/tome-db/src/content/paths.ts):

- `ORDERED_ASSOCIATIONS_FILENAME = "ordered-associations.json"`
- `orderedAssociationsFilePath(contentRoot)`

### 2. Wire engine

In [`ordered-associations.ts`](../../packages/tome-db/src/ordered-associations.ts):

- Remove `SCENES_BY_BOOK`, `CONFIGS`, and hardcoded `PRODUCTS_DATABASE_ID` if scope discovery no longer needs it
- Replace with:

```typescript
function loadConfigs(contentDir?: string): OrderedAssociationConfig[] {
  return loadOrderedAssociationsFromContent(contentDir ?? resolveContentPath()).configs;
}
```

- `getConfigByProvider`, `getOrderedAssociationConfigForDatabase`, `getConfig` search loaded configs
- Pass `contentDir` through from `getOrderedAssociationView` / move mutations (already available via `resolveContentPath()`)

**Scope discovery:** If `PRODUCTS_DATABASE_ID` was only used to enumerate product tabs, derive scopes from graph traversal via `scopeCompositeType` — do not hardcode a products database id.

### 3. Cache sync

Add `ordered-associations.json` to `contentSnapshotMtime()` in [`content/sync.ts`](../../packages/tome-db/src/content/sync.ts) and invalidate cache on model file watch.

### 4. UI genericization (same PR or immediate follow-up)

Rename scene-specific symbols in [`OrderedAssociationView.tsx`](../../packages/tome-editor/src/webview/components/OrderedAssociationView.tsx) without behavior change:

| Old | New |
| --- | --- |
| `SortableSceneRow` | `SortableOrderedRow` |
| `activeSceneId` | `activeRowId` |
| `handleSceneDragEnd` | `handleRowDragEnd` |
| `sceneId` in row types | keep in API types if backend still uses `sceneId` on `OrderedAssociationRow` — optional backend rename to `rowId` in a later pass |

Backend interface `OrderedAssociationRow.sceneId` can remain for v1 to minimize API churn; document as “member node id” in comments.

### 5. Tests

- [`ordered-associations.test.ts`](../../packages/tome-db/tests/ordered-associations.test.ts) — write JSON into fixture content dir
- [`ordered-associations-api.test.ts`](../../packages/tome-editor/tests/api/ordered-associations-api.test.ts) — ensure fixture includes config file
- Add `ordered-associations-file.test.ts` for parse validation

### 6. Documentation

Update [`docs/features/ordered-associations.md`](../features/ordered-associations.md):

- Change “registered in code” → “defined in `content/model/ordered-associations.json`”
- Document file schema and link to this session guide

Update [`docs/features/tome-db.md`](../features/tome-db.md) model table with `ordered-associations.json`.

## Done when

- [ ] `content/model/ordered-associations.json` committed
- [ ] No Marloth node ids in `ordered-associations.ts` (logic only — tests may use ids)
- [ ] Scenes page still shows book tabs, part groups, drag-and-drop reorder
- [ ] `POST /api/ordered-associations/scenes-by-book/move` tests pass
- [ ] `bun run --filter tome-db test` and editor ordered-association tests pass

## Adding a second config (future)

1. Append entry to `ordered-associations.json`
2. Set `"provider": "<id>"` on the target database’s `views.json` Items tabs (`kind: "generated"`)
3. No code changes required if composites and property names match the generic engine
