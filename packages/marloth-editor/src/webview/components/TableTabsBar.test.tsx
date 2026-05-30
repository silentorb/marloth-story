import { describe, expect, test, mock } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TableTabsBar } from "./TableTabsBar";

describe("TableTabsBar", () => {
  test("renders custom tabs with add control", () => {
    render(
      <TableTabsBar
        tabs={{
          kind: "custom",
          items: [
            { id: "all", label: "All", kind: "custom" },
            { id: "active", label: "Active", kind: "custom" },
          ],
          activeTabId: "all",
          customDefinitions: [
            { id: "all", name: "All", sorts: [] },
            { id: "active", name: "Active", sorts: [] },
          ],
        }}
        onTabSelect={() => {}}
        onCreateTab={async () => {}}
        onUpdateTab={async () => {}}
        onDeleteTab={async () => {}}
      />,
    );

    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tab actions for/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Add tab" })).toBeTruthy();
  });

  test("opens tab editor on right click", () => {
    render(
      <TableTabsBar
        tabs={{
          kind: "custom",
          items: [{ id: "all", label: "All", kind: "custom" }],
          activeTabId: "all",
          customDefinitions: [{ id: "all", name: "All", sorts: [] }],
        }}
        onTabSelect={() => {}}
        onCreateTab={async () => {}}
        onUpdateTab={async () => {}}
        onDeleteTab={async () => {}}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByLabelText("Tab name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByText("Sort order")).toBeTruthy();
  });

  test("opens tab editor when clicking the active tab", () => {
    render(
      <TableTabsBar
        tabs={{
          kind: "custom",
          items: [
            { id: "all", label: "All", kind: "custom" },
            { id: "active", label: "Active", kind: "custom" },
          ],
          activeTabId: "all",
          customDefinitions: [
            { id: "all", name: "All", sorts: [] },
            { id: "active", name: "Active", sorts: [] },
          ],
        }}
        onTabSelect={() => {}}
        onCreateTab={async () => {}}
        onUpdateTab={async () => {}}
        onDeleteTab={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByLabelText("Tab name")).toBeTruthy();
  });

  test("shows draft tab and defers create until save", async () => {
    const onCreateTab = mock(async () => {});

    render(
      <TableTabsBar
        tabs={{
          kind: "custom",
          items: [{ id: "all", label: "All", kind: "custom" }],
          activeTabId: "all",
          customDefinitions: [{ id: "all", name: "All", sorts: [] }],
        }}
        onTabSelect={() => {}}
        onCreateTab={onCreateTab}
        onUpdateTab={async () => {}}
        onDeleteTab={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add tab" }));
    expect(screen.getByRole("tab", { name: "New tab" })).toBeTruthy();
    expect(screen.getByLabelText("Tab name")).toBeTruthy();
    expect(onCreateTab).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Tab name"), { target: { value: "Backlog" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onCreateTab).toHaveBeenCalledTimes(1));
    expect(onCreateTab).toHaveBeenCalledWith({
      name: "Backlog",
      sorts: [{ column: "name", direction: "asc" }],
    });
  });

  test("discards draft tab on cancel", () => {
    render(
      <TableTabsBar
        tabs={{
          kind: "custom",
          items: [{ id: "all", label: "All", kind: "custom" }],
          activeTabId: "all",
          customDefinitions: [{ id: "all", name: "All", sorts: [] }],
        }}
        onTabSelect={() => {}}
        onCreateTab={async () => {}}
        onUpdateTab={async () => {}}
        onDeleteTab={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add tab" }));
    expect(screen.getByRole("tab", { name: "New tab" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("tab", { name: "New tab" })).toBeNull();
  });

  test("hides generated tab chrome", () => {
    render(
      <TableTabsBar
        tabs={{
          kind: "generated",
          items: [
            { id: "book-a", label: "Book A", kind: "generated" },
            { id: "book-b", label: "Book B", kind: "generated" },
          ],
          activeTabId: "book-a",
        }}
        onTabSelect={() => {}}
      />,
    );

    expect(screen.getByRole("tab", { name: "Book A" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add tab" })).toBeNull();
  });
});
