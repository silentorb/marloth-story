import { mock, describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";

mock.module("./MarlothEditor", () => ({
  MarlothEditor: () => <div data-testid="marloth-editor-stub" />,
}));

import { PropertiesSectionView } from "./PropertiesSectionView";
import { NodePageView } from "./NodePageView";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { makeNodePageDetail, makeDatabaseViewDetail } from "../test-fixtures/node-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("NodePageView", () => {
  test("renders title, metadata, markdown, and relation sections", () => {
    const api = makeMockEditorApi("standalone");

    render(
      <UserSettingsProvider api={api}>
        <NodePageView
          api={api}
          node={makeNodePageDetail()}
          saveState="idle"
          metadataExpanded={false}
          onMetadataExpandedChange={() => {}}
          onBodyChange={() => {}}
          onTitleChange={() => {}}
          onTabSelect={() => {}}
          onOrderedAssociationViewChange={() => {}}
          onOpenNode={() => {}}
          onArchiveNode={async () => {}}
          onDeleteNode={async () => {}}
        />
      </UserSettingsProvider>,
    );

    const titleField = screen.getByRole("textbox", { name: "Page title" }) as HTMLTextAreaElement;
    expect(titleField.value).toBe("Example page");
    expect(screen.getByRole("button", { name: /Metadata/i })).toBeTruthy();
    expect(screen.getByTestId("marloth-editor-stub")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Related items", level: 2 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Page actions" })).toHaveLength(2);
  });

  test("renders embedded database table section", () => {
    const api = makeMockEditorApi("standalone");
    const node = makeNodePageDetail({
      isTypeTable: true,
      sections: [
        { type: "markdown", body: "# Database page\n" },
        { type: "database", databaseView: makeDatabaseViewDetail() },
      ],
    });

    render(
      <UserSettingsProvider api={api}>
        <NodePageView
          api={api}
          node={node}
          saveState="idle"
          metadataExpanded={false}
          onMetadataExpandedChange={() => {}}
          onBodyChange={() => {}}
          onTitleChange={() => {}}
          onTabSelect={() => {}}
          onOrderedAssociationViewChange={() => {}}
          onOpenNode={() => {}}
          onArchiveNode={async () => {}}
          onDeleteNode={async () => {}}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ New row" })).toBeTruthy();
  });

  test("renders Properties section when present", () => {
    const api = makeMockEditorApi("standalone");
    const node = makeNodePageDetail({
      properties: {
        type: "properties",
        databaseId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        typeTitle: "Features",
        columns: ["priority"],
        columnDefs: [
          {
            key: "priority",
            name: "Priority",
            type: "enum",
            enumId: "priority",
            options: ["Low", "Medium", "High"],
            defaultValue: "Low",
          },
        ],
        cells: { priority: "High" },
      },
    });

    render(
      <UserSettingsProvider api={api}>
        <NodePageView
          api={api}
          node={node}
          saveState="idle"
          metadataExpanded={false}
          onMetadataExpandedChange={() => {}}
          onBodyChange={() => {}}
          onTitleChange={() => {}}
          onTabSelect={() => {}}
          onOrderedAssociationViewChange={() => {}}
          onOpenNode={() => {}}
          onArchiveNode={async () => {}}
          onDeleteNode={async () => {}}
        />
      </UserSettingsProvider>,
    );

    const propertiesHeading = screen.getByRole("heading", { name: "Properties", level: 2 });
    const propertiesSection = propertiesHeading.closest("section");
    expect(propertiesSection).toBeTruthy();
    expect(within(propertiesSection!).getByRole("button", { name: "Priority" })).toBeTruthy();
  });
});

describe("PropertiesSectionView", () => {
  test("renders computed fields as read-only", () => {
    const api = makeMockEditorApi("standalone");

    render(
      <PropertiesSectionView
        api={api}
        nodeId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        section={{
          type: "properties",
          databaseId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          typeTitle: "Characters",
          columns: ["all_scene_count"],
          columnDefs: [
            {
              key: "all_scene_count",
              name: "All Scene count",
              type: "number",
              source: "dynamic",
            },
          ],
          cells: { all_scene_count: "3" },
        }}
        onOpenNode={() => {}}
      />,
    );

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/computed/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Priority" })).toBeNull();
  });
});
