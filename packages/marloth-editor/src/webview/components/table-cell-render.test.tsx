import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { renderTableCell } from "./table-cell-render";

describe("renderTableCell", () => {
  test("renders enum dropdown when onEnumChange is provided", () => {
    render(
      <>
        {renderTableCell({
          column: "priority",
          value: "High",
          columnDef: {
            key: "priority",
            name: "Priority",
            type: "enum",
            enumId: "priority",
            options: ["Low", "High"],
          },
          onEnumChange: async () => {},
        })}
      </>,
    );
    expect(screen.getByRole("combobox", { name: "Priority" })).toBeTruthy();
  });
});
