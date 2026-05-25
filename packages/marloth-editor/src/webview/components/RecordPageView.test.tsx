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
          onDatabaseViewChange={() => {}}
          onScopeChange={() => {}}
          onOrderedAssociationViewChange={() => {}}
          onOpenRecord={() => {}}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByRole("heading", { name: "Example page", level: 1 })).toBeTruthy();
    expect(screen.getByTestId("marloth-editor-stub")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related items", level: 2 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
  });
});
