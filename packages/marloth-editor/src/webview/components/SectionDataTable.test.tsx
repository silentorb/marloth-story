import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { SectionDataTable } from "./SectionDataTable";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("SectionDataTable", () => {
  test("sorts rows when a column header is clicked", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <UserSettingsProvider api={api}>
        <SectionDataTable
          tableKey="test-table"
          columns={["priority"]}
          columnLabels={{ priority: "Priority" }}
          rows={[
            { id: "a", name: "Alpha", cells: { priority: "Low" } },
            { id: "b", name: "Beta", cells: { priority: "High" } },
          ]}
          renderNameCell={(row) => row.name}
        />
      </UserSettingsProvider>,
    );

    const priorityHeader = screen.getByRole("button", { name: "Priority" });
    fireEvent.click(priorityHeader);

    const names = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(names[0]).toContain("Beta");
    expect(names[1]).toContain("Alpha");
  });

  test("renders add-row footer when provided via custom cell renderer", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <UserSettingsProvider api={api}>
        <SectionDataTable
          tableKey="test-table-plain"
          columns={["status"]}
          rows={[{ id: "a", name: "Row", cells: { status: "Open" } }]}
          renderNameCell={(row) => row.name}
          renderCell={(column, value) => `${column}:${value}`}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByText("status:Open")).toBeTruthy();
  });
});
