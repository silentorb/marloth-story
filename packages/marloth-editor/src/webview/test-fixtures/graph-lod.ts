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
            title: "Anchor node",
            path: "Marloth/Anchor",
            group: "Anchor",
            labels: ["Anchor"],
          },
        ],
        relationships: [],
      },
      {
        nodes: [
          {
            id: anchorId,
            title: "Anchor node",
            path: "Marloth/Anchor",
            group: "Anchor",
            labels: ["Anchor"],
          },
          {
            id: neighborId,
            title: "Neighbor node",
            path: "Marloth/Neighbor",
            group: "Neighbor",
            labels: ["Neighbor"],
          },
        ],
        relationships: [
          {
            id: "connection-anchor-neighbor",
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
