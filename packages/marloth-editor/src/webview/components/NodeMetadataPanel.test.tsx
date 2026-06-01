import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { NodeMetadataPanel } from "./NodeMetadataPanel";
import { makeMockEditorApi } from "../test-fixtures/mock-api";
import type { NodePageMetadata } from "../../shared/types";

const metadata: NodePageMetadata = {
  createdAt: "2024-01-15T10:00:00.000Z",
  modifiedAt: "2024-06-01T12:30:00.000Z",
  relationshipCount: 3,
  backlinks: [
    {
      sourceId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Source page",
      linkText: "Target page",
    },
  ],
};

describe("NodeMetadataPanel", () => {
  test("shows summary when collapsed", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <NodeMetadataPanel
        api={api}
        metadata={metadata}
        expanded={false}
        onExpandedChange={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(screen.getByText(/3 relationships · 1 backlink/)).toBeTruthy();
  });

  test("shows metadata rows when expanded", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <NodeMetadataPanel
        api={api}
        metadata={metadata}
        expanded={true}
        onExpandedChange={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText("Modified")).toBeTruthy();
    expect(screen.getByText("Relationships")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
