import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SectionDataTable } from "./SectionDataTable";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

const COMPONENT_DIR = import.meta.dir;

function loadTableStyles(): HTMLStyleElement {
  const css = readFileSync(join(COMPONENT_DIR, "database-table-view.css"), "utf8");
  const style = document.createElement("style");
  style.textContent = css;
  style.dataset.testTableLayout = "true";
  document.head.append(style);
  return style;
}

describe("database table layout CSS", () => {
  const css = readFileSync(join(COMPONENT_DIR, "database-table-view.css"), "utf8");

  test("caps column widths with simple max-width rules", () => {
    expect(css).toContain("max-width: 21rem");
    expect(css).toContain("max-width: 16.8rem");
    expect(css).toContain("max-width: 14rem");
    expect(css).not.toMatch(/table-layout:\s*fixed/);
    expect(css).not.toMatch(/colgroup/);
    expect(css).not.toMatch(/marloth-table-name-col/);
  });

  test("scrolls horizontally on the page shell, not inside the table wrap", () => {
    expect(css).toMatch(/\.marloth-database-table-wrap[\s\S]*width:\s*fit-content/);
    expect(css).toMatch(/\.marloth-database-table-wrap[\s\S]*overflow:\s*visible/);
    expect(css).not.toMatch(/\.marloth-database-table-wrap[\s\S]*overflow:\s*auto/);

    const mainCss = readFileSync(join(COMPONENT_DIR, "..", "styles.css"), "utf8");
    expect(mainCss).toMatch(/\.marloth-main[\s\S]*overflow:\s*auto/);
  });
});

describe("SectionDataTable column layout", () => {
  let style: HTMLStyleElement | undefined;

  afterEach(() => {
    style?.remove();
    style = undefined;
  });

  test("applies max-width caps from stylesheet", () => {
    style = loadTableStyles();
    const api = makeMockEditorApi("standalone");
    render(
      <UserSettingsProvider api={api}>
        <SectionDataTable
          tableKey="layout-max-width"
          columns={["priority"]}
          rows={[{ id: "row1", name: "Row", cells: { priority: "High" } }]}
          renderNameCell={(row) => row.name}
        />
      </UserSettingsProvider>,
    );

    const table = screen.getByRole("table");
    const wrap = table.closest(".marloth-database-table-wrap") as HTMLElement;
    const nameCell = screen.getByRole("rowheader");
    const dataHeader = screen.getByRole("columnheader", { name: "Priority" });

    expect(getComputedStyle(wrap).overflow).toBe("visible");
    expect(getComputedStyle(nameCell).maxWidth).toBe("336px");
    expect(getComputedStyle(dataHeader).maxWidth).toBe("268.8px");
  });
});
