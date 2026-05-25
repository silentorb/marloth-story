# AGENTS Guide

## Project purpose

This workspace supports a **design-heavy, highly traceable** writing process for the Marloth trilogy (Book 1 is complete; Book 2 is in active design) and related creative work. Core goals:

1. Write the Marloth books with rigorous design before and during drafting.
2. Maintain **traceability** between finished prose, design decisions, principles, motivation, and inspirations.
3. Pioneer a composite of subgenres and writing techniques.
4. Capture general writing and design ideas that may benefit others later.

The git-tracked property graph in `./data/` is the canonical store for this design corpus—not a flat archive, but a system meant to grow in complexity.

## Project Context
- This repository contains the Marloth Story project, related to the Marloth series of fantasy novels and overlapping game-design work.
- Keep updates aligned with the repository's current scope and documentation.
- The `./docs` directory contains meta information about the design of this workspace, mostly intended for AI agents. Authoritative **project feature** specs live in `./docs/features/` (see Terminology below). The **design ontology** lives at [`docs/ontology.md`](./docs/ontology.md).
- The `./data` directory contains the git-tracked SQLite property graph (`marloth.sqlite`) for story and design data.
- The `./content` directory may hold markdown exports or editor artifacts; the canonical data store is `./data/`.
- TypeScript tooling lives under `./packages/`; ephemeral build output and dependencies live at the repo root (`./dist/`, `./node_modules/`), not under `./packages/`.
- The `./exports/` directory holds Notion export archives (`.zip` or unpacked trees) used to populate the graph database.
- All external dependencies and tooling installs should be performed within the devcontainer Dockerfile (and synced on container create/update via devcontainer lifecycle). **Rebuild the container** after changing `package.json` or `bun.lock` — do not run `bun install` manually in a terminal or on the host.

## Terminology

| Term | Meaning |
| --- | --- |
| **Project feature** | A workspace capability documented in `./docs/features/` (e.g. notion import, marloth-db). Use this phrase when discussing tooling or agent specs—not graph records. |
| **Feature** (unqualified) | A **design record** in the property graph (story/game feature ideas), unless context clearly means a project feature. |

## Data modeling direction

Imported Notion data already separates records somewhat by **product** (books, game design, and related work share inspirations and structure). Expect the graph to be sliced along **multiple dimensions** over time—not only product.

**Future (not yet implemented):** some relationships should be **weighted**, not boolean. Example: a feature–inspiration link might be strong for one inspiration and weak for another. Current edges are all-or-nothing; weighted associations will likely live as numeric properties on edges (e.g. `weight`) when implemented.

## Working Conventions
- Make focused changes that address the requested task only.
- Avoid unrelated refactors unless they are required to complete the task safely.
- Prefer small, incremental edits that are easy to review.
- **Script language:** agentic scripts created for this project should use **TypeScript** (Bun) by default — place durable tooling under `packages/` with tests and a shell wrapper in `scripts/` when appropriate. **One-off temporary scripts** (exploratory, throwaway, not intended to be maintained) may still be written in Python.

## Implementation Expectations
- Read existing files before editing to preserve intent and style.
- Keep assumptions explicit in commit or PR notes when behavior is unclear.
- Run relevant checks or tests when changing code, if such checks are available.
- Add self-documentation to files under `./docs` when making agent-relevant updates.

## Feature documentation

Authoritative design specs for **project features** live in `./docs/features/` (one file per major workspace capability). They state requirements, design rationale, and behavior so agents need not re-analyze the repo for basics.

**Do not read all feature docs by default.** When your task matches a row, read only that file (and the package `AGENTS.md` if editing that package). Treat the feature doc as the source of truth over implementation when they disagree—update code or the doc explicitly.

For **design data** (what records mean, how they relate conceptually), read [`docs/ontology.md`](./docs/ontology.md) **in addition to** schema-specific docs below.

| If your task involves… | Read |
| --- | --- |
| Design domain model, record types, relationships, traceability | [`docs/ontology.md`](./docs/ontology.md) |
| SQLite property graph, `data/marloth.sqlite`, `packages/marloth-db/` | [`docs/features/marloth-db.md`](./docs/features/marloth-db.md) (+ ontology when interpreting data) |
| Notion export → graph import, `packages/notion-importer/`, `./exports/` | [`docs/features/notion-import.md`](./docs/features/notion-import.md) |
| Content watcher/pipeline, `packages/rippledoc/`, rippling linked docs | [`docs/features/rippledoc.md`](./docs/features/rippledoc.md) |
| Web markdown editor, `packages/marloth-editor/`, VS Code graph editing | [`docs/features/marloth-editor.md`](./docs/features/marloth-editor.md) |
| Editing story/design content in the graph | [`docs/ontology.md`](./docs/ontology.md) + marloth-db as needed |

See also [`docs/features/README.md`](./docs/features/README.md) for the feature-doc template and how to add new features.

## Future Expansion
- Architecture overview
- Standard test and validation commands
- Language/framework-specific coding conventions
