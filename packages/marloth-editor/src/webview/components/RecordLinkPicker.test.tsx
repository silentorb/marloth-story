import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, mock } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { RecordLinkPicker } from "./RecordLinkPicker";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

const COMPONENT_DIR = import.meta.dir;

describe("RecordLinkPicker CSS", () => {
  const pickerCss = readFileSync(join(COMPONENT_DIR, "record-link-picker.css"), "utf8");
  const relationCss = readFileSync(join(COMPONENT_DIR, "relation-cell-editor.css"), "utf8");

  test("base list uses bounded vertical scroll", () => {
    expect(pickerCss).toMatch(/\.marloth-record-link-picker-list[\s\S]*max-height:\s*240px/);
    expect(pickerCss).toMatch(/\.marloth-record-link-picker-list[\s\S]*overflow-y:\s*auto/);
    expect(pickerCss).toMatch(/\.marloth-record-link-picker-list[\s\S]*overscroll-behavior:\s*contain/);
  });

  test("embedded relation popup list uses bounded vertical scroll", () => {
    expect(relationCss).toMatch(
      /\.marloth-relation-field-popup-add \.marloth-record-link-picker-list[\s\S]*max-height:\s*200px/,
    );
    expect(relationCss).toMatch(
      /\.marloth-relation-field-popup-add \.marloth-record-link-picker-list[\s\S]*overflow-y:\s*auto/,
    );
    expect(relationCss).toMatch(
      /\.marloth-relation-field-popup-add \.marloth-record-link-picker-list[\s\S]*overscroll-behavior:\s*contain/,
    );
  });
});

describe("RecordLinkPicker", () => {
  test("sorts search results by title ascending", async () => {
    const search = mock(async () => [
      { id: "cccccccccccccccccccccccccccccccc", title: "Zeta", primaryTypeTitle: null },
      { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", title: "Alpha", primaryTypeTitle: null },
      { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Mike", primaryTypeTitle: null },
    ]);
    const api = {
      ...makeMockEditorApi(),
      search,
    };

    const view = render(
      <RecordLinkPicker
        api={api}
        embedded
        excludedIds={[]}
        ariaLabel="Search records"
        onSelect={async () => {}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(search).toHaveBeenCalled());
    await waitFor(async () => {
      expect(await view.findAllByRole("option")).toHaveLength(3);
    });
    const options = await view.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Alpha", "Mike", "Zeta"]);
  });

  test("omits excluded ids from search results", async () => {
    const search = mock(async () => [
      { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", title: "Alpha", primaryTypeTitle: null },
      { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Beta", primaryTypeTitle: null },
      { id: "cccccccccccccccccccccccccccccccc", title: "Gamma", primaryTypeTitle: null },
    ]);
    const api = {
      ...makeMockEditorApi(),
      search,
    };

    const view = render(
      <RecordLinkPicker
        api={api}
        embedded
        excludedIds={["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]}
        ariaLabel="Search records"
        onSelect={async () => {}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(search).toHaveBeenCalled());
    await waitFor(async () => {
      expect(await view.findAllByRole("option")).toHaveLength(2);
    });
    const options = await view.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Alpha", "Gamma"]);
  });

  test("requests full type-scoped result set when allowedTypeIds is set", async () => {
    const search = mock(async () => []);
    const api = {
      ...makeMockEditorApi(),
      search,
    };
    const featuresDbId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    render(
      <RecordLinkPicker
        api={api}
        embedded
        allowedTypeIds={[featuresDbId]}
        excludedIds={[]}
        ariaLabel="Search features"
        onSelect={async () => {}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(search).toHaveBeenCalledWith("", 5000, [featuresDbId]);
  });
});
