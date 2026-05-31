import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { GlobalSearch } from "./GlobalSearch";
import type { EditorApi } from "../api/client";
import type { NodeSummary } from "../../shared/types";

function makeApi(results: NodeSummary[]): EditorApi {
  return {
    host: "standalone",
    search: mock(async () => results),
  } as unknown as EditorApi;
}

const sampleResults: NodeSummary[] = [
  { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", title: "Alpha Scene", path: "Marloth/Scenes/Alpha" },
  { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", title: "Beta Feature", path: "Marloth/Features/Beta" },
];

describe("GlobalSearch", () => {
  test("does not render when closed", () => {
    const { container } = render(
      <GlobalSearch
        api={makeApi(sampleResults)}
        open={false}
        onOpenChange={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(container.querySelector(".marloth-global-search")).toBeNull();
  });

  test("searches node titles and opens a result", async () => {
    const onOpenNode = mock((_nodeId: string, _openInNewTab?: boolean) => {});
    const { container } = render(
      <GlobalSearch
        api={makeApi(sampleResults)}
        open
        onOpenChange={() => {}}
        onOpenNode={onOpenNode}
      />,
    );

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
    const { container } = render(
      <GlobalSearch
        api={makeApi(sampleResults)}
        open
        onOpenChange={() => {}}
        onOpenNode={onOpenNode}
      />,
    );

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

  test("closes on Escape", () => {
    const onOpenChange = mock((_open: boolean) => {});
    render(
      <GlobalSearch
        api={makeApi(sampleResults)}
        open
        onOpenChange={onOpenChange}
        onOpenNode={() => {}}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
