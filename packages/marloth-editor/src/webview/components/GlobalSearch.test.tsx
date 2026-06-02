import { describe, expect, mock, test } from "bun:test";
import type { ComponentProps } from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { GlobalSearch } from "./GlobalSearch";
import type { EditorApi } from "../api/client";
import type { NodeSummary } from "../../shared/types";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import {
  applyUserSettingsPatch,
  emptyUserSettings,
  type UserSettings,
} from "../../shared/user-settings";

const sampleResults: NodeSummary[] = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", title: "Alpha Scene", primaryTypeTitle: null },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Beta Feature", primaryTypeTitle: null },
];

const resultsWithPreview: NodeSummary[] = [
  {
    id: "cccccccccccccccccccccccccccccccc",
    title: "Gamma Note",
    primaryTypeTitle: null,
    matchPreview: {
      parts: [
        { text: "…", highlight: false },
        { text: "before ", highlight: false },
        { text: "needle", highlight: true },
        { text: " after", highlight: false },
        { text: "…", highlight: false },
      ],
    },
  },
];

function makeApi(
  results: NodeSummary[],
  options?: {
    search?: ReturnType<typeof mock>;
    settings?: UserSettings;
    onPatch?: (patch: Parameters<EditorApi["patchUserSettings"]>[0]) => UserSettings;
  },
): EditorApi {
  let settings = options?.settings ?? emptyUserSettings();
  const search =
    options?.search ??
    mock(async () => results);
  return {
    host: "standalone",
    search,
    getUserSettings: mock(async () => settings),
    patchUserSettings: mock(async (patch) => {
      settings = options?.onPatch
        ? options.onPatch(patch)
        : applyUserSettingsPatch(settings, patch);
      return settings;
    }),
  } as unknown as EditorApi;
}

function renderGlobalSearch(
  props: Omit<ComponentProps<typeof GlobalSearch>, "api"> & {
    api?: EditorApi;
    results?: NodeSummary[];
  },
) {
  const api = props.api ?? makeApi(props.results ?? sampleResults);
  return render(
    <UserSettingsProvider api={api}>
      <GlobalSearch
        open={props.open}
        onOpenChange={props.onOpenChange}
        onOpenNode={props.onOpenNode}
        api={api}
      />
    </UserSettingsProvider>,
  );
}

describe("GlobalSearch", () => {
  test("does not render when closed", () => {
    const { container } = renderGlobalSearch({
      open: false,
      onOpenChange: () => {},
      onOpenNode: () => {},
    });
    expect(container.querySelector(".marloth-global-search")).toBeNull();
  });

  test("renders standalone result links with node query URLs", async () => {
    const onOpenNode = mock((_nodeId: string, _openInNewTab?: boolean) => {});
    const { container } = renderGlobalSearch({
      open: true,
      onOpenChange: () => {},
      onOpenNode,
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".marloth-global-search-item")).toHaveLength(2);
    });

    const link = container.querySelector(
      ".marloth-global-search-item",
    ) as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toContain("node=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    fireEvent.click(link);
    expect(onOpenNode).not.toHaveBeenCalled();
  });

  test("vscode Enter uses onOpenNode for keyboard navigation", async () => {
    const onOpenNode = mock((_nodeId: string, _openInNewTab?: boolean) => {});
    const api = {
      ...makeApi(sampleResults),
      host: "vscode" as const,
      navigate: mock(() => {}),
    };
    const { container } = renderGlobalSearch({
      api,
      open: true,
      onOpenChange: () => {},
      onOpenNode,
    });

    const input = container.querySelector(
      ".marloth-global-search-input",
    ) as HTMLInputElement;

    await waitFor(() => {
      expect(container.querySelectorAll(".marloth-global-search-item")).toHaveLength(2);
    });

    const link = container.querySelector(
      ".marloth-global-search-item",
    ) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "marloth://node/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    expect(onOpenNode).toHaveBeenCalledWith("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", true);
  });

  test("shows body match preview when search node contents is enabled", async () => {
    const search = mock(async () => resultsWithPreview);
    const api = makeApi(resultsWithPreview, { search });

    const { container } = renderGlobalSearch({
      api,
      open: true,
      onOpenChange: () => {},
      onOpenNode: () => {},
    });

    const checkbox = container.querySelector(
      ".marloth-global-search-config-item input",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(container.querySelector(".marloth-global-search-preview")).toBeTruthy();
    });

    const preview = container.querySelector(".marloth-global-search-preview");
    expect(preview?.querySelector("strong")?.textContent).toBe("needle");
  });

  test("hides body match preview when search node contents is disabled", async () => {
    const search = mock(async () => resultsWithPreview);
    const api = makeApi(resultsWithPreview, { search });

    const { container } = renderGlobalSearch({
      api,
      open: true,
      onOpenChange: () => {},
      onOpenNode: () => {},
    });

    await waitFor(() => {
      expect(container.querySelector(".marloth-global-search-title")).toBeTruthy();
    });

    expect(container.querySelector(".marloth-global-search-preview")).toBeNull();
  });

  test("passes includeBody when search node contents is enabled", async () => {
    const search = mock(async () => sampleResults);
    const api = makeApi(sampleResults, { search });

    const { container } = renderGlobalSearch({
      api,
      open: true,
      onOpenChange: () => {},
      onOpenNode: () => {},
    });

    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });

    const checkbox = container.querySelector(
      ".marloth-global-search-config-item input",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("", 25, undefined, { includeBody: true });
    });
  });

  test("closes on Escape", () => {
    const onOpenChange = mock((_open: boolean) => {});
    renderGlobalSearch({
      open: true,
      onOpenChange,
      onOpenNode: () => {},
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
