import { describe, expect, test, mock } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RelationCellEditor } from "./RelationCellEditor";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("RelationCellEditor", () => {
  test("opens popup from edit control and removes link inside dialog", async () => {
    const onRemove = mock(async () => {});
    const { container } = render(
      <RelationCellEditor
        api={makeMockEditorApi()}
        links={[{ targetId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Parent" }]}
        columnName="Parents"
        onAdd={async () => {}}
        onRemove={onRemove}
        onOpenNode={() => {}}
      />,
    );

    const cell = container.querySelector(".marloth-relation-cell");
    expect(cell).toBeTruthy();
    fireEvent.mouseEnter(cell!);

    fireEvent.click(screen.getByRole("button", { name: "Edit Parents links" }));
    expect(screen.getByRole("dialog", { name: "Edit Parents links" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove Parent" }));
    await waitFor(() =>
      expect(onRemove).toHaveBeenCalledWith("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    );
  });

  test("standalone cell link uses native href without custom click handler", () => {
    const onOpenNode = mock(() => {});
    const { container } = render(
      <RelationCellEditor
        api={makeMockEditorApi("standalone")}
        links={[{ targetId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Parent" }]}
        columnName="Parents"
        onAdd={async () => {}}
        onRemove={async () => {}}
        onOpenNode={onOpenNode}
      />,
    );

    const link = screen.getByRole("link", { name: "Parent" });
    expect(link.getAttribute("href")).toContain("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    fireEvent.click(link);
    expect(onOpenNode).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector(".marloth-relation-cell.is-popup-open")).toBeNull();
  });

  test("adds link inside dialog without closing", async () => {
    const search = mock(async () => [
      { id: "cccccccccccccccccccccccccccccccc", title: "Child", path: null },
    ]);
    const onAdd = mock(async () => {});
    const api = {
      ...makeMockEditorApi(),
      search,
    };

    const { container } = render(
      <RelationCellEditor
        api={api}
        links={[]}
        columnName="Parents"
        onAdd={onAdd}
        onRemove={async () => {}}
        onOpenNode={() => {}}
      />,
    );

    fireEvent.mouseEnter(container.querySelector(".marloth-relation-cell")!);
    fireEvent.click(screen.getByRole("button", { name: "Edit Parents links" }));
    expect(screen.getByRole("dialog", { name: "Edit Parents links" })).toBeTruthy();

    await waitFor(() => expect(search).toHaveBeenCalled());
    const option = await screen.findByRole("option", { name: /Child/ });
    fireEvent.click(option);
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "Edit Parents links" })).toBeTruthy();
  });

  test("shows link labels and overflow suffix in compact cell", () => {
    const manyLinks = Array.from({ length: 30 }, (_, index) => ({
      targetId: `${index}`.padStart(32, "0"),
      title: `Feat ${index + 1}`,
    }));

    render(
      <RelationCellEditor
        api={makeMockEditorApi("standalone")}
        links={manyLinks}
        columnName="Parents"
        onAdd={async () => {}}
        onRemove={async () => {}}
        onOpenNode={() => {}}
      />,
    );

    expect(screen.getByRole("link", { name: "Feat 1" })).toBeTruthy();
    const body = document.querySelector(".marloth-relation-cell-links");
    expect(body?.textContent).toMatch(/\d+\+/);
  });
});
