import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { RelationSectionView } from "./RelationSectionView";
import { FIXTURE_PAGE_ID, FIXTURE_TARGET_ID, FIXTURE_TYPE_ID, makeRelationSection } from "../test-fixtures/node-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

function renderRelationSection(host: "standalone" | "vscode" = "standalone") {
  const api = makeMockEditorApi(host);
  return render(
    <UserSettingsProvider api={api}>
      <RelationSectionView
        api={api}
        nodeId={FIXTURE_PAGE_ID}
        section={makeRelationSection()}
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

  test("standalone section title link targets type node", () => {
    renderRelationSection("standalone");

    const link = screen.getByRole("link", { name: "Related items" });
    expect(link.getAttribute("href")).toContain(`node=${FIXTURE_TYPE_ID}`);
  });

  test("renders vscode row links with marloth:// href", () => {
    renderRelationSection("vscode");

    const link = screen.getByRole("link", { name: "Linked record" });
    expect(link.getAttribute("href")).toBe(`marloth://node/${FIXTURE_TARGET_ID}`);
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

  test("filters rows using search_<label> URL param", () => {
    window.history.replaceState(
      {},
      "",
      "http://127.0.0.1:5173/?node=abc&search_RELATED=linked",
    );
    renderRelationSection();

    expect(
      (screen.getByRole("searchbox", { name: "Filter table rows by name" }) as HTMLInputElement).value,
    ).toBe("linked");
    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
  });

  test("filters rows when typing in search input", () => {
    window.history.replaceState({}, "", "http://127.0.0.1:5173/?node=abc");
    renderRelationSection();

    fireEvent.change(screen.getByRole("searchbox", { name: "Filter table rows by name" }), {
      target: { value: "nope" },
    });

    expect(screen.getByText('No rows match “nope”.')).toBeTruthy();
    expect(window.location.search).toContain("search_RELATED=nope");
  });
});
