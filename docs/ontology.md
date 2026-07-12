# Marloth design ontology

## Summary

This document describes the **domain model** of the Marloth design corpus in human-friendly terms: what kinds of things exist, what they mean, and how they relate. It is **storage-agnostic**—agents should treat it as the conceptual source of truth for *what the data is about*, independent of SQLite tables or legacy export quirks.

For how nodes are stored and queried, see [`docs/features/tome-db.md`](./features/tome-db.md).

## When to read this

Read this doc when your task involves:

- Understanding or editing **design nodes** in the graph (scenes, features, inspirations, products, etc.)
- Reasoning about **relationships** between creative, design, and finished-work artifacts
- Deciding how new nodes should be categorized or linked
- Traceability questions (why does this scene exist? what principle does it serve?)

**Read both** this ontology and the schema-specific docs when interacting with data: ontology for *meaning*, schema docs for *mechanics*.

## How agents should use this doc

| Question | Start here | Then consult |
| --- | --- | --- |
| What is a “feature” in this project? | [Terminology](#terminology) | — |
| What kinds of nodes exist? | [Entity types](#entity-types) | `IS_A` membership, relationship patterns |
| What does a relationship *mean*? | [Relationship types](#relationship-types) | Relationship `label` in SQLite |
| How is work scoped to a book vs game? | [Dimensions](#dimensions) | `PRODUCTS` / `PRODUCT` relationships |
| How does design connect to finished prose? | [Traceability](#traceability) | Node property `body`, scene nodes |

When ontology and storage disagree, **update one explicitly**—usually the ontology first (intent), then schema or import mapping.

## Terminology

| Term | Meaning |
| --- | --- |
| **Project feature** | Workspace tooling documented in `./docs/features/` (import pipeline, database package, etc.). Never use “feature” alone for this. |
| **Node** | Any entity in the design graph unless context specifies otherwise. |
| **Relationship** | Directed labeled relationship between nodes (e.g. `INSPIRATIONS`, `IS_A`). |
| **Page** | Editor UI for a node (`NodePageView`, page title, sections)—not a raw export file. |
| **Feature** | A **design node**: a story, world, or craft idea the author may implement (e.g. *Desperation*, *Guest consultant*, *Dark forest*). Lives in the graph under `Marloth/Features/` and related paths. |
| **Product** | A **deliverable umbrella**: a book, game, or related work that consumes and organizes design (e.g. *TWOLD*, *A Child's Fairytale World*, *The Shadowhood*). Products share inspirations and structural patterns. |
| **Inspiration** | An external or reference work that informs design (novel, film, game, trope cluster). |
| **Scene** | A unit of story action—often the bridge between high-level design and eventual prose. |

## Entity types

Types below are **semantic**. In the graph, type is inferred from title, `IS_A` membership, and relationship patterns. Any node may serve as a type when used as an `IS_A` target. Relationship rules live in [`content/model/schema.json`](./features/schema.md).

### Creative outputs and scope

| Type | Description | Typical location (legacy path) |
| --- | --- | --- |
| **Product** | Top-level deliverable: a book in the trilogy, a game, or adjacent work. Primary **scope** dimension. | `Marloth/Data/Products/` |
| **Part** | Major division within a book's structure (e.g. *The Orphanage*, *The Castle*). | `Marloth/TWOLD Plot/.../Parts database/` |
| **Arc** | Plot or thematic thread spanning scenes (e.g. forest arc, sorceress arc). | `Marloth/TWOLD Plot/Arcs/` |
| **Scene** | Concrete story beat or sequence; primary unit linking plot structure to future prose. | `Marloth/Scenes/`, `Marloth/TWOLD Plot/.../Scene Archive/` |

### Design vocabulary

| Type | Description | Typical location |
| --- | --- | --- |
| **Feature** | Named design idea, mechanism, tone, or technique to employ or avoid. | `Marloth/Features/` |
| **Inspiration** | Reference work or cultural source driving tone, structure, or motif. | `Marloth/Inspirations/` |
| **Tension** | Paired or opposing forces in the design space (e.g. wonderland vs responsibility). | `Marloth/Data/Tensions/` |
| **Problem** | Open design question or gap. | `Marloth/Data/Problems/` |
| **Solution** | Proposed answer to a problem or way to resolve a tension. | `Marloth/Solutions/` |
| **Motivation** | Rationale for a choice—why something should exist or matter narratively. | Often linked via `MOTIVATIONS` relationships |
| **Foil** | Contrasting pattern or anti-pattern (what *not* to do, or a deliberately opposed approach). | `Marloth/Archive/Foils/` |

### World and cast

| Type | Description | Typical location |
| --- | --- | --- |
| **Character** | Person (or person-like entity) in the story world. | `Marloth/Data/Characters/` |
| **Group** | Faction, family, or ensemble. | `Marloth/Data/Groups/` |
| **Location** | Place in the story world. | `Marloth/Data/Locations/` |
| **Monster** | Creature or antagonistic entity type. | `Marloth/Data/Monsters/` |
| **Character attribute** | Trait, role, or dimension applied to characters. | `Marloth/Data/Character Attributes/` |

### Craft, pacing, and systems

| Type | Description | Typical location |
| --- | --- | --- |
| **Article** | Longer-form design essay, exploration, or general writing idea (may outlive a single product). | `Marloth/Articles/` |
| **Pacing type** | Temporal rhythm model (days, weeks, etc.) linked to inspirations. | `Marloth/Inspirations/Pacing types/` |
| **Traversal type / reason** | How and why movement or progression through space/time works in the design. | Linked via `TRAVERSAL_*` relationships |
| **Restriction** | Constraint on what the work may do. | `Marloth/Data/Restrictions/` |
| **Prop type** | Category of story object or symbolic item. | Linked via `PROP_TYPE` relationships |

### Meta and archive

| Type | Description | Notes |
| --- | --- | --- |
| **Task** | Action item from planning; may reference features or arcs. | `Task List/` |
| **Archive** | Superseded or experimental material kept for reference. Hub node links members via **set membership (`member_of`)** (not path prefix). Incident relationships are flagged `"archived": true` in content and omitted from the SQLite cache until unarchived. | Archive hub `0f558a609a56485185beed4d1fd1cd9f`; legacy paths under `Marloth/Archive/` |

Not every node fits one type cleanly. Composite and cross-linked nodes are expected—use **relationships** and **dimensions** rather than forcing a single label.

## Relationship types

Relationships express **meaning**, not just linkage. Imported relation properties become directed relationships; labels are uppercase slug forms of the property name (e.g. `Inspirations` → `INSPIRATIONS`).

### Common semantic relationships

| Relationship | Typical meaning | Example |
| --- | --- | --- |
| **MEMBER_OF** | Member belongs to a set (type table, Archive hub, future collections); scalars on edge | Marloth example: `member_of` storage with `members` inverse — tooling: [sets.md](../../tome/docs/features/sets.md) |
| **INCLUDES** | Symmetric cross-entity association (scene↔character, inspiration↔feature, etc.); which column you see depends on the current row and target database | Scene ↔ character in cast |
| **INSPIRATIONS** | *(legacy composite on taxonomy rows)* B references external work A | Monster type ↔ inspiration |
| **FEATURES** | *(legacy perspective; storage is often `includes`)* B engages design feature A | Scene uses *Desperation* |
| **MOTIVATIONS** | A explains why B exists | Motivation node → scene |
| **SCENES** | Parent contains or orders child scenes | Part → scenes in sequence |
| **PART** / **ARCS** | Structural containment or membership | Scene belongs to arc / part |
| **PRODUCTS** / **PRODUCT** | Scoped to deliverable | Part → *A Child's Fairytale World* |
| **CHARACTERS**, **LOCATIONS**, **MONSTERS** | World elements present in or relevant to node | Scene → characters |
| **SOLUTIONS** | Proposed resolution linked to problem or tension | Solution → tension |
| **BLOCKING** / **BLOCKED_BY** | Dependency or sequencing constraint | Task A blocks task B |
| **PARENTS** / **CHILDREN** | Hierarchical decomposition | Design tree |

### Relationship strength (future)

Today, relationships are **boolean**: linked or not. The author intends **weighted relationships** for many pairs—especially **feature ↔ inspiration**, where some inspirations strongly shape a feature and others only weakly apply. Weights are not implemented yet; when added they will be numeric relationship properties (e.g. `weight`) without changing the underlying ontology.

## Dimensions

Nodes are organized along several **dimensions**. Only some are explicit today; others are implied by paths and relationships.

| Dimension | Role today | Notes |
| --- | --- | --- |
| **Product** | Primary scope slice | Books, game, shared corpus |
| **Plot structure** | Part, arc, scene hierarchy | TWOLD-heavy |
| **Design layer** | Feature, tension, solution, motivation | Cross-product |
| **Reference layer** | Inspiration, article, foil | Shared across products |
| **World layer** | Character, location, monster, group | Shared or product-specific |
| **Craft layer** | Pacing, traversal, articles | Techniques portable to other writers |

Expect **additional dimensions** over time. The ontology should evolve; storage may use node labels, properties, or relationship metadata to make dimensions queryable.

## Traceability

A core project goal is linking **finished work** back through **design** to **intent** and **sources**. A typical traceability chain:

```text
Inspiration → Feature → Motivation → Scene → (future) Prose
                ↓
             Tension → Solution
                ↓
             Product / Part / Arc (scope)
```

Agents helping with design or writing should preserve and strengthen these links—not treat nodes as isolated notes. When adding or editing nodes, ask:

1. **What product(s)** does this serve?
2. **What design ideas (features)** does it implement or test?
3. **What inspirations** inform it—and how strongly (when weights exist)?
4. **Why** does it exist (motivation, tension, problem)?
5. **Where** does it land in structure (part, arc, scene)?

## Articles and portable ideas

**Articles** often capture general craft insights that may benefit readers beyond Marloth. They may reference features and inspirations but are not always tied to a single product. Treat them as a bridge between the private design graph and potentially publishable writing-about-writing.

## Current storage mapping (brief)

This section is a **hint**, not the authoritative schema spec.

| Ontology | Current storage (SCHEMA_VERSION 6) |
| --- | --- |
| Node | `nodes` row; JSON `properties` |
| Node type (semantic) | title, body; `member_of` targets |
| Type table | `member_of` target and/or declared in `table-schemas.json` (`isTypeTableNode`) |
| Relationship rules | `content/model/schema.json` |
| Relationship | `relationships` row with `label` + JSON `properties` |
| Prose / notes | Node property `body` (markdown) — **first section** on every page |
| Database row scalars | Relationship properties on `(page)-[:member_of]->(type)` — not on the page node |
| Relation metadata | Relationship properties on labeled relationships (e.g. `ordinal`, future `weight`) |
| Stable identity | 32-hex node id (pages) or database id (CSVs) |

### Universal pages (direction)

The corpus is moving away from the legacy split between “database rows” and “markdown pages.” **Every design node has a page in the editor** that may combine:

1. **Markdown section** — primary prose and notes (`body` on the node).
2. **Relationship sections** — one table per outgoing association label (not set membership; see below).
3. **Members table section** — for type-table / set nodes, members listed via incoming `members` perspective with full column schema (tabs, sorts, editing).

Instance nodes show **Properties** (scalars from the `member_of` edge) instead of a membership relation table.

Scalar values that belonged to a database row (except Name/title) **belong on the `member_of` relationship**, not duplicated on the page node, unless the value is clearly intrinsic to the referenced node itself.

Full DDL and import rules: [`docs/features/tome-db.md`](./features/tome-db.md).

## Evolution

This ontology will grow with the trilogy and game work. When adding entity or relationship types:

1. Document them here in plain language.
2. Align import tooling or manual conventions if needed.
3. Prefer explicit schema rules or properties over folder-path inference over time.

## See also

- [`AGENTS.md`](../AGENTS.md) — project purpose, terminology, modeling direction
- [`docs/features/tome-db.md`](./features/tome-db.md) — property graph schema and API
