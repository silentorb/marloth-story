import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { OrderedAssociationView } from "./OrderedAssociationView";
import { makeMockEditorApi } from "../test-fixtures/mock-api";
import type { OrderedAssociationViewDetail } from "../../shared/types";

const view: OrderedAssociationViewDetail = {
  configId: "scenes-by-book",
  typeDatabaseId: "204dba198db74611b0b49a98dd53e8f5",
  typeDatabaseTitle: "Scenes",
  scopes: [
    { id: "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", name: "TWOLD" },
    { id: "bookbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", name: "Fairytale" },
  ],
  activeScopeId: "bookaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  groups: [
    {
      groupId: "part1111111111111111111111111111",
      title: "Part 1",
      rows: [
        { sceneId: "scene111111111111111111111111111", name: "Opening", cells: { status: "Yes" } },
      ],
    },
    {
      groupId: "__unassigned__",
      title: "Unassigned",
      rows: [],
    },
  ],
  columns: ["status"],
};

describe("OrderedAssociationView", () => {
  test("renders book tabs without sortable column headers", () => {
    const api = makeMockEditorApi("standalone");

    render(
      <OrderedAssociationView
        api={api}
        configId="scenes-by-book"
        view={view}
        onScopeChange={() => {}}
        onViewChange={() => {}}
        onOpenRecord={() => {}}
      />,
    );

    expect(screen.getByRole("tab", { name: "TWOLD" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Fairytale" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Part 1", level: 3 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Opening" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
  });
});
