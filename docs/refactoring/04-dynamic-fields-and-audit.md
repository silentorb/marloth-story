# Session 04 — Dynamic fields and type-membership audit

## Purpose

1. Remove **unparameterized** Marloth composite type strings from dynamic field resolvers — behavior driven by [`content/model/dynamic-fields.json`](../../content/model/dynamic-fields.json) params.
2. Make type-membership audit path rules use **workspace legacy prefix** instead of hardcoded `Marloth/`.
3. Remove or archive dead legacy schema parsing code.

## Depends on

[Session 01](./01-workspace-json.md) for `workspace.legacy.exportPathPrefix` (audit). Dynamic field param migration can start independently but audit refactor should wait for workspace loader.

## Part A — Dynamic field resolvers

### Current state

- Bindings: [`content/model/dynamic-fields.json`](../../content/model/dynamic-fields.json)
- Registry: [`packages/tome-db/src/dynamic-fields/index.ts`](../../packages/tome-db/src/dynamic-fields/index.ts) — registers four resolver ids
- Algorithms: [`packages/tome-db/src/dynamic-fields/resolvers/index.ts`](../../packages/tome-db/src/dynamic-fields/resolvers/index.ts)

Hardcoded composite fallbacks in resolver code (must become params):

| Resolver | Hardcoded composite / label | Suggested param key |
| --- | --- | --- |
| `characters.allSceneCount` | `scenes_characters`, legacy edge `scenes` | `characters_scene_composite`, `scenes_edge_label` (partially exists) |
| `characters.sceneCountByProduct` | `scenes_product`, `scenes_characters` | `scene_product_composite`, `characters_scene_composite` |
| `inspirations.weightedUse` | `inspirations_features` | `inspiration_feature_composite`, `features_edge_label` (exists) |
| `inspirations.wonder` | `inspirations_features` | same as weighted use |

### Implementation steps

1. **Audit** each function in `resolvers/index.ts` for string literals that name composite types or legacy edge labels.

2. **Params contract** — document required keys in [`docs/dynamic-fields/`](../dynamic-fields/) per-field specs and in [`docs/features/dynamic-table-fields.md`](../features/dynamic-table-fields.md).

3. **Resolver changes** — read params only; if composite param is empty, skip composite path (do not fall back to Marloth-specific default):

```typescript
const composite = String(params.characters_scene_composite ?? "");
if (composite) {
  // listRelationshipsForComposite(db, nodeId, composite)
}
```

Keep legacy unidirectional edge fallback **only** when explicitly configured via params (e.g. `scenes_edge_label`).

4. **Update Marloth `dynamic-fields.json`** — add full params to every field and columnSet:

```json
{
  "id": "characters-all-scene-count",
  "params": {
    "characters_scene_composite": "scenes_characters",
    "scenes_edge_label": "scenes"
  }
}
```

Similar for inspirations fields (`inspiration_feature_composite`, existing `features_edge_label`, `theme_edge_label`, `theme_target_id`).

5. **Registry unchanged** — resolver **ids** (`characters.allSceneCount`, etc.) remain stable plugin names; only JSON bindings change.

6. **Tests** — [`dynamic-fields.test.ts`](../../packages/tome-db/tests/dynamic-fields/dynamic-fields.test.ts): fixtures must include params; add regression test that fails if resolver uses default composite when param omitted.

### Done (Part A)

- [ ] No Marloth-specific composite string literals as default values in `resolvers/index.ts`
- [ ] Marloth `dynamic-fields.json` has complete params
- [ ] `bun run --filter tome-db test` passes for dynamic-fields tests

---

## Part B — Type membership audit

### Current state

[`packages/tome-db/src/type-membership-audit.ts`](../../packages/tome-db/src/type-membership-audit.ts) assumes legacy export paths under `Marloth/`:

- `typeFolderFromPath` — `segments[0] !== "Marloth"`
- `typeDatabaseTitleFromPath` — same
- Used by [`scripts/check-type-membership.ts`](../../scripts/check-type-membership.ts), not runtime page assembly

### Implementation steps

1. Add optional `exportPathPrefix` argument to path helpers (default from `loadWorkspace().legacy.exportPathPrefix ?? "Marloth"`).

2. Replace literal `"Marloth"` comparisons with configurable prefix segment.

3. Module docstring: **“Validation/migration tooling for legacy export layout — not used by editor runtime.”**

4. Update [`scripts/check-type-membership.ts`](../../scripts/check-type-membership.ts):

   - Prefer `TOME_CONTENT_PATH` / `resolveContentPath()` over `MARLOTH_DB_PATH` only
   - Open graph via content store or `openTomeWriteContext` when possible

5. Tests in [`type-membership-audit.test.ts`](../../packages/tome-db/tests/type-membership-audit.test.ts) — pass custom prefix in unit tests where paths are constructed.

### Done (Part B)

- [ ] No literal `"Marloth"` in audit path logic (except test fixtures and default in workspace.json)
- [ ] `check-type-membership.ts` runs against current corpus

---

## Session done when

- [ ] Parts A and B checklists complete
- [ ] `bun test` passes
- [ ] Field spec docs updated under `docs/dynamic-fields/` where params changed
