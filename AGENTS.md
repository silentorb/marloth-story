# AGENTS Guide

## Project Context
- This repository contains the Marloth Story project, related to the Marloth series of fantasy novels.
- Keep updates aligned with the repository's current scope and documentation.
- The `./docs` directory contains meta information about the design of this workspace, mostly intended for AI agents. For the Notion → `content/` import pipeline, layout, and front-matter rules, see `./docs/notion-conversion.md`.
- The `./content` directory contains all of the articles, design, records, and prose for the Marloth books.
- TypeScript tooling lives under `./packages/`; ephemeral build output and dependencies live at the repo root (`./dist/`, `./node_modules/`), not under `./packages/`.
- The `./external/notion/` directory contains exported Notion data which is used to populate `./content` files.
- All external dependencies and tooling installs should be performed within the devcontainer Dockerfile, not via user-local or post-create commands.

## Working Conventions
- Make focused changes that address the requested task only.
- Avoid unrelated refactors unless they are required to complete the task safely.
- Prefer small, incremental edits that are easy to review.

## Implementation Expectations
- Read existing files before editing to preserve intent and style.
- Keep assumptions explicit in commit or PR notes when behavior is unclear.
- Run relevant checks or tests when changing code, if such checks are available.
- Add self-documentation to files under `./docs` when making agent-relevant updates.

## Rippledoc (`packages/rippledoc`)
- Watches `content/` and runs the content pipeline on changes, rippling work through linked documents.
- Run from repo root: `bun run --cwd packages/rippledoc start` or `./scripts/rippledoc`.
- Settings: every option is available via CLI and environment variables; **CLI overrides env** over defaults. See `bun run --cwd packages/rippledoc start -- --help`.

## Future Expansion
- Architecture overview
- Standard test and validation commands
- Language/framework-specific coding conventions
