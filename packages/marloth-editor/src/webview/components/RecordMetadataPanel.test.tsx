import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { RecordMetadataPanel } from "./RecordMetadataPanel";
import { makeMockEditorApi } from "../test-fixtures/mock-api";
import type { RecordPageMetadata } from "../../shared/types";

const metadata: RecordPageMetadata = {
  createdAt: "2024-01-15T10:00:00.000Z",
  modifiedAt: "2024-06-01T12:30:00.000Z",
  connectionCount: 3,
  backlinks: [
    {
      sourceId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Source page",
      path: null,
      linkText: "Target page",
    },
  ],
};

describe("RecordMetadataPanel", () => {
  test("shows summary when collapsed", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <RecordMetadataPanel
        api={api}
        metadata={metadata}
        expanded={false}
        onExpandedChange={() => {}}
        onOpenRecord={() => {}}
      />,
    );
    expect(screen.getByText(/3 connections · 1 backlink/)).toBeTruthy();
  });

  test("shows metadata rows when expanded", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <RecordMetadataPanel
        api={api}
        metadata={metadata}
        expanded={true}
        onExpandedChange={() => {}}
        onOpenRecord={() => {}}
      />,
    );
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText("Modified")).toBeTruthy();
    expect(screen.getByText("Connections")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
