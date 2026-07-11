# Session 05 — Legacy compatibility and cleanup

## Purpose

Document and implement **non-breaking** legacy compatibility policies, wire remaining branding from workspace config, and run final verification. No user-visible behavior breaks for existing Marloth links, env vars, or saved preferences.

## Depends on

Sessions [02](./02-editor-workspace-integration.md)–[04](./04-dynamic-fields-and-audit.md) should be largely complete; individual items below can land incrementally.

## Legacy compatibility policy

| Surface | Policy | Action |
| --- | --- | --- |
| `marloth:` / `marloth://node/` URLs | Support indefinitely | Keep in [`markdown-links.ts`](../../packages/tome-db/src/markdown-links.ts); no removal timeline |
| `MARLOTH_*` environment variables | Deprecated alias for `TOME_*` | Keep fallback reads in paths/config; document in feature docs |
| `data/marloth.sqlite` | Legacy cache path | Keep fallback when `tome.sqlite` absent ([`content/paths.ts`](../../packages/tome-db/src/content/paths.ts)) |
| `.marloth/user-settings.json` | Legacy settings dir | Keep fallback ([`tome-editor/src/api/paths.ts`](../../packages/tome-editor/src/api/paths.ts)) |
| `marloth.graph.*` localStorage | Graph Explorer prefs | Dual-read: try `tome.graph.*` first, fall back to `marloth.graph.*` once, optionally write new keys only |
| `@deprecated` TS aliases | `marlothHref`, `MarlothWriteContext`, `openMarlothWriteContext`, … | Keep until grep-clean across repo; do not remove in this session unless zero usages |
| `packages/tome-editor/dist/extension.js` | Orphan VS Code extension build | Delete if not shipped (no `src/` counterpart in package); confirm with `package.json` scripts |

Document this table in [`docs/features/tome-db.md`](../features/tome-db.md) under a “Legacy compatibility” subsection.

## Graph Explorer localStorage migration

File: [`packages/tome-editor/src/webview/graph-preferences.ts`](../../packages/tome-editor/src/webview/graph-preferences.ts)

Current keys:

- `marloth.graph.showNodeLabels`
- `marloth.graph.showRelevanceDiagnostics`
- `marloth.graph.explorerMode`
- `marloth.graph.layerDepth`
- `marloth.graph.relativeDetail`

Implementation pattern:

```typescript
const NEW_KEY = "tome.graph.showNodeLabels";
const LEGACY_KEY = "marloth.graph.showNodeLabels";

function readBool(key: string, legacyKey: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
  ...
}
```

On write, persist to `tome.graph.*` only.

Update [`graph-preferences.test.ts`](../../packages/tome-editor/tests/webview/graph-preferences.test.ts).

## Branding from workspace

### Static site header

[`packages/tome-static-site/src/layouts/NodeLayout.astro`](../../packages/tome-static-site/src/layouts/NodeLayout.astro):

- Replace hardcoded `Marloth design corpus` with value from workspace at build time
- Options: embed in generated `site-data.json` during `generate-data.ts`, or read workspace in Astro build via `loadWorkspaceFromContent`

### Editor document title

[`packages/tome-editor/src/webview/document-title.ts`](../../packages/tome-editor/src/webview/document-title.ts):

- Replace constant `APP_TITLE = "Tome"` with workspace `branding.appTitle` (fallback `"Tome"`)
- Pass from App after workspace fetch

### Milkdown meta key (optional, low priority)

[`dynamic-node-link-decoration.ts`](../../packages/tome-editor/src/webview/dynamic-node-link-decoration.ts): `marlothDynamicTitleRefresh` — dual-read like graph prefs if renaming.

## Orphan artifacts

1. Confirm [`packages/tome-editor/dist/extension.js`](../../packages/tome-editor/dist/extension.js) is not referenced by `package.json` or VS Code extension publish flow
2. If orphan, delete `dist/extension.js` and `dist/extension.js.map` (keep `dist-webview/` for production webview)

## Documentation pass

1. **[`docs/features/tome-editor.md`](../features/tome-editor.md)** — workspace.json, `/api/workspace`, corrected home id, sidebar from config
2. **[`docs/features/tome-db.md`](../features/tome-db.md)** — full model file list including `workspace.json`, `ordered-collections.json`; legacy compat subsection
3. **[`docs/features/ordered-collections.md`](../features/ordered-collections.md)** — JSON config location (if session 03 done)
4. **[`docs/features/graph-explorer.md`](../features/graph-explorer.md)** — update localStorage key names if migrated to `tome.graph.*`
5. **[00-overview.md](./00-overview.md)** — check off global completion checklist items

Root [`AGENTS.md`](../../AGENTS.md) should already link this series (see below).

## AGENTS.md routing

Ensure root AGENTS.md includes (under Feature documentation or new **Refactoring guides** subsection):

| Marloth → Tome decoupling (workspace config migration) | [`docs/refactoring/00-overview.md`](./docs/refactoring/00-overview.md) |

Do **not** add per-session rows — agents start at 00-overview.

## Final verification

Run from repo root:

```bash
bun test
```

Optional after session 04:

```bash
bun run scripts/check-type-membership.ts
```

Manual smoke:

1. Open editor — sidebar, home, graph explorer anchor unchanged
2. Open a Scenes ordered-association view — reorder still works
3. Characters / Inspirations database tables show dynamic columns
4. Static site build: `bun run web:build` — home page resolves

## Done when

- [x] Legacy compat documented in feature docs
- [x] Graph Explorer localStorage dual-read (if implemented) tested
- [x] Static site header and editor app title use workspace branding
- [x] Global checklist in [00-overview.md](./00-overview.md) all checked
- [x] `bun test` green

## Out of scope

- Removing `marloth:` link support
- Renaming repo or root package `marloth-story`
- Migrating all scripts from `MARLOTH_*` to `TOME_*` only (fallbacks remain)
