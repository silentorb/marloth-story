import { describe, expect, test } from "bun:test";
import {
  applyUserSettingsPatch,
  databaseTableSortKey,
  isDefaultTableSort,
  nextSortOnColumnClick,
  normalizeTableSort,
  parseUserSettings,
  relationTableSortKey,
  sortTableRows,
  effectiveTableSort,
  tableSortForKey,
  viewSortsToTableSort,
} from "./user-settings";

describe("user-settings", () => {
  test("relation and database table keys are stable", () => {
    expect(relationTableSortKey("abc", "RELATED")).toBe("records/abc/relations/RELATED");
    expect(databaseTableSortKey("page", "db", "Default")).toBe(
      "records/page/database/db/Default",
    );
  });

  test("default sort is name ascending and is not persisted", () => {
    expect(isDefaultTableSort({ orderBy: [{ column: "name", direction: "asc" }] })).toBe(true);
    expect(isDefaultTableSort({ orderBy: [{ column: "name", direction: "desc" }] })).toBe(false);
  });

  test("nextSortOnColumnClick toggles active column and switches columns", () => {
    const current = { orderBy: [{ column: "name", direction: "asc" as const }] };
    expect(nextSortOnColumnClick(current, "name")).toEqual([
      { column: "name", direction: "desc" },
    ]);
    expect(nextSortOnColumnClick(current, "priority")).toEqual([
      { column: "priority", direction: "asc" },
    ]);
  });

  test("effectiveTableSort uses tab default until user overrides", () => {
    const settings = {
      version: 1 as const,
      tableSorts: {
        "records/db": { orderBy: [{ column: "name", direction: "desc" as const }] },
      },
    };
    const tabDefault = viewSortsToTableSort([{ column: "priority", direction: "desc" }]);

    expect(effectiveTableSort({ version: 1 }, "records/db", tabDefault)).toEqual(tabDefault);
    expect(effectiveTableSort(settings, "records/db", tabDefault).orderBy[0]?.column).toBe("name");
  });

  test("viewSortsToTableSort maps view sort specs to table sort specs", () => {
    expect(
      viewSortsToTableSort([
        { column: "priority", direction: "desc" },
        { column: "name", direction: "asc" },
      ]),
    ).toEqual({
      orderBy: [
        { column: "priority", direction: "desc" },
        { column: "name", direction: "asc" },
      ],
    });
  });

  test("sortTableRows supports multi-column order specs", () => {
    const rows = [
      { id: "1", name: "Beta", cells: { priority: "High" } },
      { id: "2", name: "Alpha", cells: { priority: "High" } },
      { id: "3", name: "Gamma", cells: { priority: "Low" } },
    ];

    const byName = sortTableRows(rows, {
      orderBy: [
        { column: "priority", direction: "asc" },
        { column: "name", direction: "asc" },
      ],
    });

    expect(byName.map((row) => row.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  test("applyUserSettingsPatch stores sparse overrides only", () => {
    const base = { version: 1 as const };
    const withOverride = applyUserSettingsPatch(base, {
      tableSorts: {
        "records/a/relations/X": { orderBy: [{ column: "priority", direction: "desc" }] },
      },
    });
    expect(withOverride.tableSorts?.["records/a/relations/X"]).toEqual({
      orderBy: [{ column: "priority", direction: "desc" }],
    });

    const cleared = applyUserSettingsPatch(withOverride, {
      tableSorts: {
        "records/a/relations/X": { orderBy: [{ column: "name", direction: "asc" }] },
      },
    });
    expect(cleared.tableSorts).toBeUndefined();
  });

  test("parseUserSettings drops default sorts and invalid entries", () => {
    const parsed = parseUserSettings({
      version: 1,
      tableSorts: {
        keep: { orderBy: [{ column: "priority", direction: "asc" }] },
        drop: { orderBy: [{ column: "name", direction: "asc" }] },
        bad: { orderBy: [] },
      },
    });

    expect(tableSortForKey(parsed, "keep").orderBy[0]?.column).toBe("priority");
    expect(parsed.tableSorts?.drop).toBeUndefined();
    expect(parsed.tableSorts?.bad).toBeUndefined();
    expect(normalizeTableSort(undefined)).toEqual({
      orderBy: [{ column: "name", direction: "asc" }],
    });
  });
});
