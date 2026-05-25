import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { RelationSectionView } from "./RelationSectionView";
import { FIXTURE_TARGET_ID, makeRelationSection } from "../test-fixtures/record-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("RelationSectionView", () => {
  test("renders standalone row links with record query URLs", () => {

    render(
      <RelationSectionView
        api={makeMockEditorApi("standalone")}
        section={makeRelationSection()}
        onOpenRecord={() => {}}
      />,
    );

    const link = screen.getByRole("link", { name: "Linked record" });
    expect(link.getAttribute("href")).toContain(`record=${FIXTURE_TARGET_ID}`);
    expect(screen.getByRole("columnheader", { name: "Priority" })).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
  });

  test("renders vscode row controls as buttons", () => {
    render(
      <RelationSectionView
        api={makeMockEditorApi("vscode")}
        section={makeRelationSection()}
        onOpenRecord={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Linked record" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Linked record" })).toBeNull();
  });
});
