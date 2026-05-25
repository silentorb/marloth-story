# Ordered associations

## Summary

**Ordered associations** are graph relationships whose sequence matters. The workspace manages order automatically through dedicated UI—users never edit an `order` field directly. The first configured instance is **Scenes** on the Scenes database record page: scenes are ordered within each book (Product), grouped by Part for display, and reordered via drag-and-drop.

## When to read this

Read this doc when your task involves:

- Scene ordering within a book
- Drag-and-drop reordering of graph associations
- The `order` edge property on `IS_A` membership edges
- Extending ordered-association configuration to new record types

For graph storage basics, read [marloth-db.md](./marloth-db.md). For the editor UI, read [marloth-editor.md](./marloth-editor.md). For domain semantics (Scene, Part, Product), read [`../ontology.md`](../ontology.md).

## Requirements

### Core model

- Ordered associations **must** store sequence in a designated edge property (`order` by default) on the membership edge (e.g. `(scene)-[:IS_A {order}]->(Scenes database)`).
- The `order` property **must** be treated as import/metadata: hidden from all table columns and never exposed as an editable field in the UI.
- Order **must** be scoped: for scenes, order applies within a **book** (Product), not globally across all scenes in the database.
- **Grouping** (Part) is a display dimension only; all scenes in a book share one global sequence. Part subsections sort scenes by that book-wide order.
- Part membership **must** resolve when import created duplicate part vertices: match Scene→`PART` to the canonical Parts-database row by title, then fall back to Part→`SCENES` containment edges.
- Configurations **must** be registered in code (`packages/marloth-db/src/ordered-associations.ts`); v1 has no UI for adding new configs.

### Scenes configuration (`scenes-by-book`)

| Setting | Value |
| --- | --- |
| Type database | Scenes NotionDatabase (`204dba198db74611b0b49a98dd53e8f5`) |
| Membership edge | `IS_A` with `order` property |
| Scope (book tabs) | `PRODUCT` edge from scene → Product |
| Group (part subsections) | `PART` edge from scene → Part |
| Unassigned | Scenes with a Product but no Part appear in an **Unassigned** group at the end |

### Editor UI (Scenes Items section)

- The Scenes database **Items** section **must** replace the flat database table with an ordered-association view.
- Book tabs **must** appear at the start of the section; each tab filters to one Product that has scenes.
- Each Part **must** have its own subsection with a table of scenes in that part.
- Tables **must** be sorted only by `order` (server-provided); column header sorting **must not** be available.
- Users **must** be able to drag scenes within a part to reorder (book-wide sequence).
- Users **must** be able to drag scenes to a different part to change the `PART` association.
- Name cells **must** remain navigable links to scene records.

### Mutations

- Reorder and part-change operations **must** update the graph via the editor REST API.
- Only scenes whose `PRODUCT` edge matches the active book scope **may** be mutated.
- On any move, the system **must** reassign sparse integer order values (`10, 20, 30, …`) to all scenes in the active scope.

### Import interaction

- Full Notion re-import is **deprecated** for workflow (see [notion-import.md](./notion-import.md)). It would merge edge properties and **could overwrite** manually adjusted `order` values from CSV.
- **Authoritative:** graph `order` from ordered-association edits and direct DB updates. Preserve `order` when mining export data into existing rows.

## Design rationale

### Hidden automatic order

Notion required manual juggling of an Order column. Ordered associations move sequencing into first-class tooling: drag-and-drop reflects author intent without exposing implementation details.

### Book-scoped order with Part grouping

Scene order is meaningful per book (Product). Parts organize the narrative structure but do not define separate sequences—a scene's position in Part 3 still reflects its place in the book's overall timeline.

### Code registry over generic UI

Scenes are the only known use case. A typed configuration registry keeps the first implementation focused and avoids premature abstraction.

## Behavior / pipeline

```
User drag-drop (webview)
  → PATCH /api/ordered-associations/scenes-by-book/move
  → applyOrderedAssociationMove (marloth-db)
  → upsert IS_A {order} + PART edge
  → SQLite data/marloth.sqlite
```

View load:

```
GET /api/records/:scenesDbId?scope=:productId
  → getRecordPageDetail
  → getOrderedAssociationView
  → ordered-association section (book tabs + part groups)
```

## Out of scope (v1)

- UI for registering new ordered-association configs
- Creating scenes or parts from the editor
- Inline editing of non-order edge scalars
- Syncing Part→`SCENES` reverse edges after reorder
- Per-part local order

## Verification

- `bun test packages/marloth-db/src` — ordered-association query and move tests
- `bun test packages/marloth-editor/src` — API and UI tests
- Manual: open Scenes database → book tabs → drag within/across parts → reload → order persists

## Implementation pointers

| Module | Responsibility |
| --- | --- |
| `packages/marloth-db/src/ordered-associations.ts` | Config registry, view query, move mutation |
| `packages/marloth-db/src/record-sections.ts` | Emits `ordered-association` section for configured databases |
| `packages/marloth-editor/src/api/server.ts` | PATCH move endpoint, `scope` query param |
| `packages/marloth-editor/src/webview/components/OrderedAssociationView.tsx` | Book tabs + DnD part tables |

## See also

- [marloth-db.md](./marloth-db.md)
- [marloth-editor.md](./marloth-editor.md)
- [`../ontology.md`](../ontology.md)
