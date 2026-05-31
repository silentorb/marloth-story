import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { OrderedAssociationView } from "./OrderedAssociationView";
import { makeMockEditorApi } from "../test-fixtures/mock-api";
import type { OrderedAssociationViewDetail } from "../../shared/types";

const view: OrderedAssociationViewDetail = {
  configId: "scenes-by-book",
  typeDatabaseId: "204dba198db74611b0b49a98dd53e8f5",
  typeDatabaseTitle: "Scenes",
  tabs: {
    kind: "generated",
    items: [
      { id: "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", label: "TWOLD", kind: "generated" },
      { id: "bookbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", label: "Fairytale", kind: "generated" },
    ],
    activeTabId: "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
  groups: [
    {
      groupId: "part1111111111111111111111111111",
      title: "Part 1",
      rows: [
        {
          sceneId: "scene111111111111111111111111111",
          name: "Opening",
          cells: { characters: "Hero" },
          relationCells: {
            characters: [{ targetId: "char1111111111111111111111111111", title: "Hero" }],
          },
        },
      ],
    },
    {
      groupId: "__unassigned__",
      title: "Unassigned",
      rows: [],
    },
  ],
  columns: ["solutions", "characters", "location"],
  columnDefs: [
    { key: "solutions", name: "Solutions", type: "relation", relationType: "solutions" },
    { key: "characters", name: "📁 Characters", type: "relation", relationType: "characters" },
    { key: "location", name: "📁 Location", type: "relation", relationType: "location" },
  ],
};

describe("OrderedAssociationView", () => {
  test("renders book tabs and schema-driven column headers", () => {
    const api = makeMockEditorApi("standalone");

    const { getByRole, getAllByRole, queryByRole } = render(
      <OrderedAssociationView
        api={api}
        configId="scenes-by-book"
        view={view}
        onTabSelect={() => {}}
        onViewChange={() => {}}
        onOpenNode={() => {}}
      />,
    );

    expect(getByRole("tab", { name: "TWOLD" })).toBeTruthy();
    expect(getByRole("tab", { name: "Fairytale" })).toBeTruthy();
    expect(getByRole("heading", { name: "Part 1", level: 3 })).toBeTruthy();
    expect(getByRole("link", { name: "Opening" })).toBeTruthy();
    expect(getAllByRole("button", { name: "Reorder Solutions column" }).length).toBeGreaterThan(0);
    expect(getAllByRole("button", { name: "Reorder 📁 Characters column" }).length).toBeGreaterThan(0);
    expect(getAllByRole("button", { name: "Reorder 📁 Location column" }).length).toBeGreaterThan(0);
    expect(queryByRole("columnheader", { name: "Status" })).toBeNull();
  });
});
