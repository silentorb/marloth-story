import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { PageActionsMenu } from "./PageActionsMenu";

describe("PageActionsMenu", () => {
  test("shows Remove only when onRemove is provided", async () => {
    const onRemove = mock(async () => {});

    render(
      <PageActionsMenu
        recordTitle="Row page"
        recordPath={null}
        trigger="edit"
        menuPlacement="inline"
        onArchive={async () => {}}
        onRemove={onRemove}
        onDelete={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("omits Remove from the page app bar menu", () => {
    render(
      <PageActionsMenu
        recordTitle="Current page"
        recordPath="Marloth/Pages/Example"
        onArchive={async () => {}}
        onDelete={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    expect(screen.queryByRole("menuitem", { name: "Remove" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
  });
});
