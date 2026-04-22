# AGENTS Guide

## Project Context
- This repository contains the Marloth Story project, related to the Marloth series of fantasy novels.
- Keep updates aligned with the repository's current scope and documentation.
- The `./docs` directory contains meta information about the design of this workspace, mostly intended for AI agents. For the Notion → `src/` import pipeline, layout, and front-matter rules, see `./docs/notion-conversion.md`.
- The `./src` directory contains all of the articles, design, records, and prose for the Marloth books.
- The `./external/notion/` directory contains exported Notion data which is used to populate `./src` files.

## Working Conventions
- Make focused changes that address the requested task only.
- Avoid unrelated refactors unless they are required to complete the task safely.
- Prefer small, incremental edits that are easy to review.

## Implementation Expectations
- Read existing files before editing to preserve intent and style.
- Keep assumptions explicit in commit or PR notes when behavior is unclear.
- Run relevant checks or tests when changing code, if such checks are available.
- Add self-documentation to files under `./docs` when making agent-relevant updates.

## Future Expansion
- Architecture overview
- Standard test and validation commands
- Language/framework-specific coding conventions
