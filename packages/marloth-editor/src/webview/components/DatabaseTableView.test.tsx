import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { DatabaseTableView } from "./DatabaseTableView";
import { UserSettingsProvider } from "../hooks/useUserSettings";
import { makeDatabaseViewDetail, FIXTURE_DATABASE_ID } from "../test-fixtures/node-page";
import { makeMockEditorApi } from "../test-fixtures/mock-api";

describe("DatabaseTableView", () => {
  test("renders database rows and column headers", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <UserSettingsProvider api={api}>
        <DatabaseTableView
          api={api}
          nodeId={FIXTURE_DATABASE_ID}
          databaseView={makeDatabaseViewDetail()}
          onViewChange={() => {}}
          onOpenNode={() => {}}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByRole("columnheader", { name: /Name/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Priority/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Linked record" })).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
  });

  test("shows view tabs and calls onViewChange", () => {
    const api = makeMockEditorApi("standalone");
    let selectedView = "All";
    const databaseView = makeDatabaseViewDetail({
      views: ["All", "Active"],
      view: "All",
    });

    render(
      <UserSettingsProvider api={api}>
        <DatabaseTableView
          api={api}
          nodeId={FIXTURE_DATABASE_ID}
          databaseView={databaseView}
          onViewChange={(view) => {
            selectedView = view;
          }}
          onOpenNode={() => {}}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(selectedView).toBe("Active");
  });

  test("shows empty state when there are no rows", () => {
    const api = makeMockEditorApi("standalone");
    render(
      <UserSettingsProvider api={api}>
        <DatabaseTableView
          api={api}
          nodeId={FIXTURE_DATABASE_ID}
          databaseView={makeDatabaseViewDetail({ rows: [], columns: [] })}
          onViewChange={() => {}}
          onOpenNode={() => {}}
        />
      </UserSettingsProvider>,
    );

    expect(screen.getByText("No rows in this view.")).toBeTruthy();
  });
});
