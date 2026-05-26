import { mock, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { makeRecordPageDetail } from "./test-fixtures/record-page";
import { makeMockEditorApi } from "./test-fixtures/mock-api";

mock.module("./components/MarlothEditor", () => ({
  MarlothEditor: () => <div data-testid="marloth-editor-stub" />,
}));

mock.module("./components/GraphView", () => ({
  GraphView: () => <div data-testid="graph-view-stub" />,
}));

const record = makeRecordPageDetail({
  id: "ebeb0a7ab2ef479a80e96ccb25e9d7b5",
  title: "Example page",
});

mock.module("./api/client", () => ({
  createEditorApi: () => ({
    ...makeMockEditorApi("standalone"),
    getRecord: async () => record,
  }),
}));

import { App } from "./App";

describe("App", () => {
  test("renders a record page from standalone URL params", async () => {
    window.history.replaceState(
      {},
      "",
      "/?scope=e028aa0786f5449984a4f497c1d746fa&record=ebeb0a7ab2ef479a80e96ccb25e9d7b5",
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Page title" })).toBeTruthy();
    });
    expect(screen.getByTestId("marloth-editor-stub")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});
