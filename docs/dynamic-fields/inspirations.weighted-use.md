# Inspirations — Weighted Use

## Summary

Sum of priority weights for all Features linked to an Inspiration.

## Database

- **NotionDatabase id:** `2eea538996934ce8abafc27132e576c1` (Inspirations)
- **Column key:** `weighted_use`
- **Column display name:** Weighted Use
- **Column type:** number

## Requirement

For each inspiration row:

1. Follow outgoing `FEATURES` relationships from the inspiration page to feature pages.
2. For each feature page, read the Features database membership relationship `(feature)-[:IS_A]->(Features DB)` and its `priority` property.
3. Map priority to weight:

| Priority | Weight |
| --- | --- |
| Low | 1 |
| Medium | 2 |
| High | 4 |
| Ultimate | 8 |
| (missing/other) | 0 |

4. **Must** sum weights across all linked features.
5. **Must** return the sum as a decimal string.

This matches the Notion formula on Features **Weight**:

```text
ifs(prop("Priority") == "Low", 1,
    prop("Priority") == "Medium", 2,
    prop("Priority") == "High", 4,
    prop("Priority") == "Ultimate", 8, 0)
```

```text
weighted_use(inspiration) =
  sum over f in FEATURES targets of priorityWeight(feature.IS_A.priority)
```

## Graph paths

| Role | Pattern |
| --- | --- |
| Inspiration row | `(inspiration)-[:IS_A]->(Inspirations DB)` |
| Feature link | `(inspiration)-[:FEATURES]->(feature)` |
| Priority source | `(feature)-[:IS_A {priority}]->(Features DB dd0de9867cc345b898929306bdf9fc83)` |

## Replaces legacy field

Notion rollup **Weighted Use** (`weighted_use` on `IS_A` relationship properties). No longer depends on Features **Weight** formula snapshots.

## Worked example

| Inspiration | Page id | Expected |
| --- | --- | --- |
| Big Trouble in Little China | (linked from Features; verify via graph search by title) | `33` |

Sum of priority weights across all linked features for this inspiration equals 33 in the current graph.

## Resolver and overlay

- **resolver_id:** `inspirations.weightedUse`
- **Overlay params:**
  - `features_edge_label`: `"FEATURES"` (relationship label; param name unchanged)
  - `features_database_id`: `"dd0de9867cc345b898929306bdf9fc83"`

## Verification

- Unit test: inspiration with features at Medium+High → `6`.
- Integration: Inspirations Weighted view sorts/filters on computed `weighted_use`.
