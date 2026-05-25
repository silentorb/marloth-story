import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { RelationSectionView } from "./RelationSectionView";
import { FIXTURE_PAGE_ID, FIXTURE_TARGET_ID, makeRelationSection } from "../test-fixtures/record-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

function renderRelationSection(host: "standalone" | "vscode" = "standalone") {
  const api = makeMockEditorApi(host);
  return render(
    <UserSettingsProvider api={api}>
      <RelationSectionView
        api={api}
        recordId={FIXTURE_PAGE_ID}
        section={makeRelationSection()}
        onOpenRecord={() => {}}
      />
    </UserSettingsProvider>,
  );
}

describe("RelationSectionView", () => {
  test("renders standalone row links with record query URLs", () => {
    renderRelationSection("standalone");

    const link = screen.getByRole("link", { name: "Linked record" });
    expect(link.getAttribute("href")).toContain(`record=${FIXTURE_TARGET_ID}`);
    expect(screen.getByRole("columnheader", { name: /Priority/ })).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
  });

  test("renders vscode row controls as buttons", () => {
    renderRelationSection("vscode");

    expect(screen.getByRole("button", { name: "Linked record" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Linked record" })).toBeNull();
  });

  test("renders sortable column headers", () => {
    renderRelationSection();

    expect(screen.getByRole("button", { name: /Name/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Priority/ })).toBeTruthy();
  });
});
