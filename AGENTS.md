# AGENTS Guide

## Project purpose

This workspace supports a **design-heavy, highly traceable** writing process for the Marloth trilogy (Book 1 is complete; Book 2 is in active design) and related creative work. Core goals:

1. Write the Marloth books with rigorous design before and during drafting.
2. Maintain **traceability** between finished prose, design decisions, principles, motivation, and inspirations.
3. Pioneer a composite of subgenres and writing techniques.
4. Capture general writing and design ideas that may benefit others later.

The git-tracked design corpus in `./content/` is a property graph: node markdown and relationship instances under `content/data/`, workspace model JSON under `content/model/`, with a local SQLite cache under `./data/` for fast queries.

## Project Context

- This repository contains the Marloth Story project, related to the Marloth series of fantasy novels and overlapping game-design work.
- Keep updates aligned with the repository's current scope and documentation.
- The `./docs` directory contains meta information about the design of this workspace, mostly intended for AI agents. Authoritative **project feature** specs for Tome tooling live in the sibling **`tome`** repo at `../tome/docs/features/` (or `repos/tome/docs/features/` from silentorb-workbench). Marloth-specific deploy docs remain in [`docs/features/static-website-deploy.md`](./docs/features/static-website-deploy.md). The **design ontology** lives at [`docs/ontology.md`](./docs/ontology.md).
- The `./content` directory is the **canonical store root**: `content/data/{nodeId}.md` per node (YAML frontmatter + markdown body) plus `relationships.json`; `content/model/` holds `relationship-types.json`, `schema.json`, `table-schemas.json`, `views.json`, and `dynamic-fields.json`.
- The `./data/tome.sqlite` file is a **local query cache** (gitignored; legacy `data/marloth.sqlite` may still exist). It is rebuilt from `./content` on editor API startup and via `bun run content:sync`.
- TypeScript domain scripts live under `./scripts/`; Tome packages (`tome-db`, `tome-editor`, `tome-static-site`) live in the sibling **`tome`** repository. In silentorb-workbench, open the devcontainer and use the **`tome` Compose service** for `editor:dev` (not this repo directly).
- The `./exports/` directory holds **archival** Notion export archives (`.zip` or unpacked trees). Use them only as a reference when data is missing from the graph—not as the primary update path (see **Graph data workflow** below).
- All external dependencies and tooling installs should be performed within the silentorb-workbench devcontainer. The **`tome` Compose service** runs the editor against this repo's `content/`. **Rebuild the container** after changing `package.json` or `bun.lock` in workbench or tome — do not run `bun install` manually in a terminal or on the host.

## Terminology


| Term                      | Meaning                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project feature**       | A workspace capability documented in the sibling **`tome`** repo under `docs/features/` (e.g. tome-db, tome-editor). Use this phrase when discussing tooling or agent specs—not graph nodes. |
| **Node**                  | Any entity in the design graph (SQLite `nodes` table). Replaces legacy *record* / *vertex* in docs and API.                                                       |
| **Relationship**          | A link between two nodes with a **relationship type** and properties. Stored compactly in `relationships.json`; SQLite cache expands to directed projections.     |
| **Page**                  | UI representation of a node in the editor (`NodePageView`, page title, sections, `getNodePageDetail`). Not the same as a Notion export file.                      |
| **Feature** (unqualified) | A **design node** (story/game feature idea), usually under `Marloth/Features/`, unless context clearly means a project feature.                                   |
| **Schema**                | Git-tracked relationship rules in `content/model/schema.json` (allowed target types per relationship type). Not SQLite DDL.                                       |
| **Type table**            | Any node used as an `IS_A` target and/or with `notion_schema` / `notion_database` metadata—not a permanent import label.                                          |


## Data modeling direction

Imported Notion data already separates nodes somewhat by **product** (books, game design, and related work share inspirations and structure). Expect the graph to be sliced along **multiple dimensions** over time—not only product.

**Future (not yet implemented):** some relationships should be **weighted**, not boolean. Example: a feature–inspiration link might be strong for one inspiration and weak for another. Current relationships are all-or-nothing; weighted associations will likely live as numeric properties on relationships (e.g. `weight`) when implemented.

## Graph data workflow

The `./content/` tree is **authoritative and git-tracked**. Notion import was a one-time migration path; ongoing work **must** edit content files (or use tooling that writes them). `TOME_CONTENT_PATH` (or legacy `MARLOTH_CONTENT_PATH`) points at the **content root** (`./content`), not `content/data`.


| Task                                 | Do                                                                                                                            | Do not                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Add or edit nodes, bodies, titles    | Edit `content/data/{nodeId}.md` or use the Tome editor / `ContentStore` (`tome-db` in sibling **tome** repo)                            | Edit `data/tome.sqlite` (or legacy `data/marloth.sqlite`) directly              |
| Add or edit relationships            | Edit `content/data/relationships.json`, `content/model/relationship-types.json`, or use editor / `ContentStore` mutation APIs | Duplicate relationships in node markdown files   |
| Dynamic field bindings               | Edit `content/model/dynamic-fields.json` or run `bun scripts/seed-dynamic-fields.ts`                                          | Use removed `dynamic_`* SQLite overlay tables    |
| Table view tabs (custom / generated) | Edit `content/model/views.json` or use editor tab CRUD                                                                        | Edit `notion_views` on node frontmatter (legacy) |
| Refresh local cache                  | `bun run content:sync` or start `editor:api` (rebuilds cache + watches `./content`)                                           | Commit `data/tome.sqlite`                     |
| One-time SQLite → content            | `bun run content:export` (from existing `data/tome.sqlite` or legacy `data/marloth.sqlite` if present)                                                     | —                                                |
| Data only in `./exports/`            | Mine archive and upsert into `./content` (same mapping rules as legacy import)                                                | Run `bun run notion:import` / `--clean`          |


See the sibling **tome** repo [`docs/features/tome-db.md`](../tome/docs/features/tome-db.md) for file formats and API. [`docs/features/notion-import.md`](../tome/docs/features/notion-import.md) documents the **legacy** import pipeline for reference and export mining only.

## Working Conventions

- Make focused changes that address the requested task only.
- Avoid unrelated refactors unless they are required to complete the task safely.
- Prefer small, incremental edits that are easy to review.
- **Regression tests:** When fixing a bug in table views (database tables, relation tables, Properties section, ordered-association tables, dynamic fields, or related API endpoints), add a regression test in the same change that would have failed before the fix. Seed test relationships using **composite types** from `content/relationship-types.json` (via `ContentStore` / `seedTestCompositeRelationships`) when the bug involves graph traversals — do not rely only on direct `db.upsertRelationship` with legacy unidirectional types. Do not close a bug fix without a test unless the user explicitly waives it.
- **Script language:** agentic scripts created for this project should use **TypeScript** (Bun) by default — place durable tooling under `packages/` with tests and a shell wrapper in `scripts/` when appropriate. **One-off temporary scripts** (exploratory, throwaway, not intended to be maintained) may still be written in Python.

## Implementation Expectations

- Read existing files before editing to preserve intent and style.
- Keep assumptions explicit in commit or PR notes when behavior is unclear.
- Run relevant checks or tests when changing code, if such checks are available.
- Add self-documentation to files under `./docs` when making agent-relevant updates.

## Feature documentation

Authoritative design specs for **project features** live in the sibling **`tome`** repo (`../tome/docs/features/`). Marloth-specific deploy documentation stays in [`docs/features/static-website-deploy.md`](./docs/features/static-website-deploy.md).

**Do not read all feature docs by default.** When your task matches a row, read only that file (and the package `AGENTS.md` if editing that package). Treat the feature doc as the source of truth over implementation when they disagree—update code or the doc explicitly.

For **design data** (what nodes mean, how they relate conceptually), read `[docs/ontology.md](./docs/ontology.md)` **in addition to** schema-specific docs below.


| If your task involves…                                                 | Read                                                                                                                                                           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design domain model, node types, relationships, traceability           | `[docs/ontology.md](./docs/ontology.md)`                                                                                                                       |
| SQLite property graph, `data/tome.sqlite`, `tome-db` | [`../tome/docs/features/tome-db.md`](../tome/docs/features/tome-db.md) (+ ontology when interpreting data) |
| Web markdown editor, `tome-editor` | [`../tome/docs/features/tome-editor.md`](../tome/docs/features/tome-editor.md) |
| Graph Explorer, LOD layers, anchor-scoped graph viz | [`../tome/docs/features/graph-explorer.md`](../tome/docs/features/graph-explorer.md) |
| Editing story/design content in the graph | [`docs/ontology.md`](./docs/ontology.md) + [`../tome/docs/features/tome-db.md`](../tome/docs/features/tome-db.md) |
| Legacy Notion import / mining `./exports/` | [`../tome/docs/features/notion-import.md`](../tome/docs/features/notion-import.md) |
| Ordered associations, scene order, drag-and-drop reorder | [`../tome/docs/features/ordered-associations.md`](../tome/docs/features/ordered-associations.md) |
| Dynamic table view fields, computed columns | [`../tome/docs/features/dynamic-table-fields.md`](../tome/docs/features/dynamic-table-fields.md) + [`../tome/docs/dynamic-fields/`](../tome/docs/dynamic-fields/) |
| Table view tabs, `views.json` | [`../tome/docs/features/views.md`](../tome/docs/features/views.md) |
| Type table columns, `table-schemas.json` | [`../tome/docs/features/table-schemas.md`](../tome/docs/features/table-schemas.md) |
| Static website generation (Astro) | [`../tome/docs/features/static-website.md`](../tome/docs/features/static-website.md) |
| Static website deploy (GitHub Actions → S3/CloudFront) | [`docs/features/static-website-deploy.md`](./docs/features/static-website-deploy.md) |


See also [`../tome/docs/features/README.md`](../tome/docs/features/README.md) for the feature-doc template.

## Refactoring guides

Multi-session migration specs (agent-oriented). Start at the overview; do not read every session doc by default.

| If your task involves… | Read |
| --- | --- |
| Marloth → Tome decoupling (workspace config migration) | [`docs/refactoring/00-overview.md`](./docs/refactoring/00-overview.md) |

## Future Expansion

- Architecture overview
- Standard test and validation commands
- Language/framework-specific coding conventions

