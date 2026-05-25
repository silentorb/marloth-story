import type { RecordPageDetail, RelationTableSection } from "../../shared/types";

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
    typeRecordId: FIXTURE_TYPE_ID,
    columns: ["priority"],
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

export function makeRecordPageDetail(
  overrides: Partial<RecordPageDetail> = {},
): RecordPageDetail {
  const sections = overrides.sections ?? [
    { type: "markdown", body: "# Example page\n\nBody text." },
    makeRelationSection(),
  ];

  return {
    id: FIXTURE_PAGE_ID,
    title: "Example page",
    path: "Folder/Example page",
    body: "# Example page\n\nBody text.",
    labels: ["NotionPage"],
    sections,
    ...overrides,
  };
}
