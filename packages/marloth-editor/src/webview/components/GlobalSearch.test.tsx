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

  test("searches node titles and opens a result", async () => {
    const onOpenNode = mock((_nodeId: string, _openInNewTab?: boolean) => {});
    const { container } = renderGlobalSearch({
      open: true,
      onOpenChange: () => {},
      onOpenNode,
    });

    const dialog = container.querySelector(".marloth-global-search");
    expect(dialog).toBeTruthy();

    const input = container.querySelector(
      ".marloth-global-search-input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alpha" } });

    await waitFor(() => {
      expect(within(dialog as HTMLElement).getByText("Alpha Scene")).toBeTruthy();
    });

    fireEvent.click(within(dialog as HTMLElement).getByText("Alpha Scene"));
    expect(onOpenNode).toHaveBeenCalledWith("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false);
  });

  test("supports keyboard navigation and modifier-enter for new tab", async () => {
    const onOpenNode = mock((_nodeId: string, _openInNewTab?: boolean) => {});
    const { container } = renderGlobalSearch({
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

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    expect(onOpenNode).toHaveBeenCalledWith("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", true);
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
