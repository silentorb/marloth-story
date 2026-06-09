import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TableLinkExistingRow,
  TableLinkExistingRowFooter,
  TableLinkExistingRowTrigger,
} from "./TableLinkExistingRow";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("TableLinkExistingRow", () => {
  test("top Link button expands the same footer picker as the footer trigger", () => {
    const api = makeMockEditorApi();
    const onLink = async () => {};

    render(
      <TableLinkExistingRow
        label="Link Feature"
        api={api}
        excludedIds={[]}
        onLink={onLink}
      >
        <TableLinkExistingRowTrigger />
        <TableLinkExistingRowFooter />
      </TableLinkExistingRow>,
    );

    expect(screen.queryByRole("searchbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ Link Feature" })).toBeNull();
  });
});
