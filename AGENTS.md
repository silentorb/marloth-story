# AGENTS Guide

## Project Context
- This repository contains the Marloth Story project, related to the Marloth series of fantasy novels.
- Keep updates aligned with the repository's current scope and documentation.
- The `./docs` directory contains meta information about the design of this workspace, mostly intended for AI agents. Authoritative feature specs live in `./docs/features/`.
- The `./content` directory contains all of the articles, design, records, and prose for the Marloth books.
- TypeScript tooling lives under `./packages/`; ephemeral build output and dependencies live at the repo root (`./dist/`, `./node_modules/`), not under `./packages/`.
- The `./external/notion/` directory contains exported Notion data which is used to populate `./content` files.
- All external dependencies and tooling installs should be performed within the devcontainer Dockerfile, not via user-local or post-create commands.

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

Authoritative design specs live in `./docs/features/` (one file per major feature). They state requirements, design rationale, and behavior so agents need not re-analyze the repo for basics.

**Do not read all feature docs by default.** When your task matches a row, read only that file (and the package `AGENTS.md` if editing that package). Treat the feature doc as the source of truth over implementation when they disagree—update code or the doc explicitly.

| If your task involves… | Read |
| --- | --- |
| Notion export → `content/` import, `packages/notion-importer/`, `external/notion/`, link rewrite, manifest, re-import | [`docs/features/notion-import.md`](./docs/features/notion-import.md) |
| Content watcher/pipeline, `packages/rippledoc/`, rippling linked docs | [`docs/features/rippledoc.md`](./docs/features/rippledoc.md) |
| Editing story/design markdown in `content/` (not import tooling) | start with the file's front matter; use feature docs only if changing import/layout conventions |

See also [`docs/features/README.md`](./docs/features/README.md) for the feature-doc template and how to add new features.

## Future Expansion
- Architecture overview
- Standard test and validation commands
- Language/framework-specific coding conventions
