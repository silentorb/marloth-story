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
    expect(screen.getByRole("button", { name: "Priority" })).toBeTruthy();
  });

  test("renders read-only enum as badge without handler", () => {
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
        })}
      </>,
    );
    expect(screen.getByText("High")).toBeTruthy();
  });

  test("renders checkbox values", () => {
    render(
      <>
        {renderTableCell({
          column: "done",
          value: "true",
          columnDef: { key: "done", name: "Done", type: "checkbox" },
        })}
      </>,
    );
    expect(screen.getByText("☑")).toBeTruthy();
  });

  test("renders relation values as badges", () => {
    render(
      <>
        {renderTableCell({
          column: "parents",
          value: "Parent A",
          columnDef: { key: "parents", name: "Parents", type: "relation" },
        })}
      </>,
    );
    expect(screen.getByText("Parent A")).toBeTruthy();
  });
});
