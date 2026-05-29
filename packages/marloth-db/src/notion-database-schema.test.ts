import { describe, expect, test } from "bun:test";
import { visiblePropertyIdsForView, type NotionViewDefinition } from "./notion-database-schema";

describe("visiblePropertyIdsForView", () => {
  test("falls back to configuration.properties when visiblePropertyIds is empty", () => {
    const view: NotionViewDefinition = {
      id: "v1",
      name: "Table",
      type: "table",
      filter: null,
      sorts: [],
      visiblePropertyIds: [],
      configuration: {
        type: "table",
        properties: [
          { property_id: "title", property_name: "Name", visible: true },
          { property_id: "pri", property_name: "Priority", visible: true },
          { property_id: "date", property_name: "Date", visible: false },
        ],
      },
    };
    expect(visiblePropertyIdsForView(view)).toEqual(["title", "pri"]);
  });

  test("prefers explicit visiblePropertyIds when set", () => {
    const view: NotionViewDefinition = {
      id: "v1",
      name: "Table",
      type: "table",
      filter: null,
      sorts: [],
      visiblePropertyIds: ["status"],
      configuration: {
        properties: [{ property_id: "pri", visible: true }],
      },
    };
    expect(visiblePropertyIdsForView(view)).toEqual(["status"]);
  });
});
