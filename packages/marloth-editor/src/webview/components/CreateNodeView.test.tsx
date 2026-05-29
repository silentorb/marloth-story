import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { CreateNodeView } from "./CreateNodeView";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("CreateNodeView", () => {
  test("submits title and calls onCreated with new id", async () => {
    const api = makeMockEditorApi();
    const created: string[] = [];
    render(
      <CreateNodeView
        api={api}
        onCancel={() => {}}
        onCreated={(id) => {
          created.push(id);
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "New page" })).toBeTruthy();

    const titleInput = screen.getByRole("textbox", { name: "Page title" });
    fireEvent.change(titleInput, { target: { value: "Fresh page" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await Promise.resolve();
    expect(created[0]).toBe("cccccccccccccccccccccccccccccccc");
  });

  test("shows error when title is empty", () => {
    render(<CreateNodeView api={makeMockEditorApi()} onCancel={() => {}} onCreated={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText("Title is required.")).toBeTruthy();
  });
});
