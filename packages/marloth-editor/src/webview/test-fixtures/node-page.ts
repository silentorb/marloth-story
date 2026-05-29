import type { NodePageDetail, RelationTableSection } from "../../shared/types";

export const FIXTURE_PAGE_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const FIXTURE_TYPE_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const FIXTURE_TARGET_ID = "cccccccccccccccccccccccccccccccc";

export function makeRelationSection(
  overrides: Partial<RelationTableSection> = {},
): RelationTableSection {
  return {
    type: "relations",
    label: "RELATED",
    title: "Related items",
    typeNodeId: FIXTURE_TYPE_ID,
    columns: ["priority"],
    columnDefs: [
      {
        key: "priority",
        name: "Priority",
        type: "enum",
        enumId: "priority",
        options: ["Low", "Medium", "High", "Ultimate", "Consideration", "Cancelled"],
        defaultValue: "Low",
      },
    ],
    rows: [
      {
        targetId: FIXTURE_TARGET_ID,
        name: "Linked record",
        path: "Folder/Linked record",
        cells: { priority: "High" },
      },
    ],
    ...overrides,
  };
}

export function makeNodePageDetail(
  overrides: Partial<NodePageDetail> = {},
): NodePageDetail {
  const sections = overrides.sections ?? [
    { type: "markdown", body: "# Example page\n\nBody text." },
    makeRelationSection(),
  ];

  return {
    id: FIXTURE_PAGE_ID,
    title: "Example page",
    path: "Folder/Example page",
    body: "# Example page\n\nBody text.",
    isTypeTable: false,
    properties: null,
    metadata: {
      createdAt: null,
      modifiedAt: null,
      relationshipCount: 1,
      backlinks: [],
    },
    sections,
    ...overrides,
  };
}
