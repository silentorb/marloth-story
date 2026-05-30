import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { RelationSectionView } from "./RelationSectionView";
import { FIXTURE_PAGE_ID, FIXTURE_TARGET_ID, makeRelationSection } from "../test-fixtures/node-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

function renderRelationSection(host: "standalone" | "vscode" = "standalone") {
  const api = makeMockEditorApi(host);
  return render(
    <UserSettingsProvider api={api}>
      <RelationSectionView
        api={api}
        nodeId={FIXTURE_PAGE_ID}
        section={makeRelationSection()}
        onOpenNode={() => {}}
      />
    </UserSettingsProvider>,
  );
}

describe("RelationSectionView", () => {
  test("renders standalone row links with node query URLs", () => {
    renderRelationSection("standalone");

    const link = screen.getByRole("link", { name: "Linked record" });
    expect(link.getAttribute("href")).toContain(`node=${FIXTURE_TARGET_ID}`);
    expect(screen.getByRole("columnheader", { name: /Priority/ })).toBeTruthy();
    const priorityTrigger = screen.getByRole("button", { name: "Priority", expanded: false });
    expect(priorityTrigger.textContent).toBe("High");
    expect(priorityTrigger.getAttribute("aria-haspopup")).toBe("listbox");
  });

  test("renders vscode row controls as buttons", () => {
    renderRelationSection("vscode");

    expect(screen.getByRole("button", { name: "Linked record" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Linked record" })).toBeNull();
  });

  test("renders sortable column headers", () => {
    renderRelationSection();

    expect(screen.getByRole("button", { name: /Name/ })).toBeTruthy();
    const priorityHeader = screen.getByRole("columnheader", { name: /Priority/ });
    expect(within(priorityHeader).getByRole("button")).toBeTruthy();
  });

  test("renders add row control", () => {
    renderRelationSection();
    expect(screen.getByRole("button", { name: /\+ New/ })).toBeTruthy();
  });
});
