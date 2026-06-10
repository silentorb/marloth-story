#!/usr/bin/env bun
/**
 * notion:import is deprecated. The canonical graph lives under content/.
 */
console.error(
  "notion:import is deprecated. Edit content/ directly (see AGENTS.md Graph data workflow).",
);
console.error("To rebuild the local cache: bun run content:sync");
console.error(
  "For export mining only, read packages/notion-importer helpers — do not run a full re-import.",
);
process.exit(1);
