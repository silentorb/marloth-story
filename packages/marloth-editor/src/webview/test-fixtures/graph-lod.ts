import type { GraphLodSnapshot } from "../../shared/types";

export function makeGraphLodSnapshot(
  overrides: Partial<GraphLodSnapshot> = {},
): GraphLodSnapshot {
  const anchorId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const neighborId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  return {
    layerCount: 2,
    levels: [
      {
        nodes: [
          {
            id: anchorId,
            title: "Anchor record",
            path: "Marloth/Anchor",
            group: "NotionPage",
            labels: ["NotionPage"],
          },
        ],
        links: [],
      },
      {
        nodes: [
          {
            id: anchorId,
            title: "Anchor record",
            path: "Marloth/Anchor",
            group: "NotionPage",
            labels: ["NotionPage"],
          },
          {
            id: neighborId,
            title: "Neighbor record",
            path: "Marloth/Neighbor",
            group: "NotionPage",
            labels: ["NotionPage"],
          },
        ],
        links: [
          {
            id: "link-anchor-neighbor",
            source: anchorId,
            target: neighborId,
            label: "related",
          },
        ],
      },
    ],
    ...overrides,
  };
}
