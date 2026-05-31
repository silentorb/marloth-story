import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

const confirmDialogCss = readFileSync(
  join(import.meta.dir, "confirm-dialog.css"),
  "utf8",
);

describe("ConfirmDialog", () => {
  test("message text wraps when rendered inside a nowrap table cell", () => {
    const style = document.createElement("style");
    style.textContent = confirmDialogCss;
    document.head.append(style);
    render(
      <div className="marloth-database-table" style={{ whiteSpace: "nowrap" }}>
        <ConfirmDialog
          open
          title="Remove from table?"
          message='Remove “Long row title” from this table? The linked page will remain; only the relationship is removed.'
          confirmLabel="Remove"
          onCancel={() => {}}
          onConfirm={() => {}}
        />
      </div>,
    );

    const message = screen.getByText(/from this table\?/);
    expect(getComputedStyle(message).whiteSpace).toBe("normal");

    style.remove();
  });
});
