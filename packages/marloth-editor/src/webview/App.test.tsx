import { mock, describe, expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { makeRecordPageDetail } from "./test-fixtures/record-page";
import { makeMockEditorApi } from "./test-fixtures/mock-api";

mock.module("./components/MarlothEditor", () => ({
  MarlothEditor: () => <div data-testid="marloth-editor-stub" />,
}));

mock.module("react-force-graph-2d", () => ({
  default: () => <div data-testid="force-graph-stub" />,
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

    const { container } = render(<App />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="marloth-editor-stub"]')).toBeTruthy();
    });
    expect(container.querySelector('[name="Page title"], textarea[aria-label="Page title"]')).toBeTruthy();
    expect(container.textContent).not.toContain("Loading…");
  });
});
