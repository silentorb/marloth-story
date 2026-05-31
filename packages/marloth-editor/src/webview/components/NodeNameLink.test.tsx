import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeNameLink, SectionTitle } from "./NodeNameLink";
import { makeMockEditorApi } from "../test-fixtures/mock-api";
import { FIXTURE_TYPE_ID } from "../test-fixtures/node-page";

describe("NodeNameLink", () => {
  test("standalone link uses native href without custom click handler", () => {
    const onOpenNode = mock(() => {});
    render(
      <NodeNameLink
        api={makeMockEditorApi("standalone")}
        nodeId={FIXTURE_TYPE_ID}
        onOpenNode={onOpenNode}
      >
        Features
      </NodeNameLink>,
    );

    const link = screen.getByRole("link", { name: "Features" });
    expect(link.getAttribute("href")).toContain(`node=${FIXTURE_TYPE_ID}`);
    fireEvent.click(link);
    expect(onOpenNode).not.toHaveBeenCalled();
  });

  test("vscode link uses button with click handler", () => {
    const onOpenNode = mock(() => {});
    render(
      <NodeNameLink
        api={makeMockEditorApi("vscode")}
        nodeId={FIXTURE_TYPE_ID}
        onOpenNode={onOpenNode}
      >
        Features
      </NodeNameLink>,
    );

    expect(screen.queryByRole("link", { name: "Features" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Features" }));
    expect(onOpenNode).toHaveBeenCalledWith(FIXTURE_TYPE_ID, false);
  });
});

describe("SectionTitle", () => {
  test("standalone section title link uses native href without custom click handler", () => {
    const onOpenNode = mock(() => {});
    render(
      <SectionTitle
        api={makeMockEditorApi("standalone")}
        title="Features"
        typeNodeId={FIXTURE_TYPE_ID}
        onOpenNode={onOpenNode}
      />,
    );

    const link = screen.getByRole("link", { name: "Features" });
    expect(link.getAttribute("href")).toContain(`node=${FIXTURE_TYPE_ID}`);
    fireEvent.click(link);
    expect(onOpenNode).not.toHaveBeenCalled();
  });
});
