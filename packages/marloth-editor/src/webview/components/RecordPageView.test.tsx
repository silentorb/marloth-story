import { mock, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

mock.module("./MarlothEditor", () => ({
  MarlothEditor: () => <div data-testid="marloth-editor-stub" />,
}));

import { RecordPageView } from "./RecordPageView";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { makeRecordPageDetail } from "../test-fixtures/record-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("RecordPageView", () => {
  test("renders markdown and relation sections from generic fixtures", () => {
    const api = makeMockEditorApi("standalone");

    render(
      <UserSettingsProvider api={api}>
        <RecordPageView
          api={api}
          record={makeRecordPageDetail()}
          saveState="idle"
          onBodyChange={() => {}}
          onTitleChange={() => {}}
          onDatabaseViewChange={() => {}}
          onScopeChange={() => {}}
          onOrderedAssociationViewChange={() => {}}
          onOpenRecord={() => {}}
          onArchiveRecord={async () => {}}
          onDeleteRecord={async () => {}}
        />
      </UserSettingsProvider>,
    );

    const titleField = screen.getByRole("textbox", { name: "Page title" }) as HTMLTextAreaElement;
    expect(titleField.value).toBe("Example page");
    expect(screen.getByTestId("marloth-editor-stub")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related items", level: 2 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page actions" })).toBeTruthy();
  });
});
