import { describe, expect, test } from "bun:test";
import { databaseMetadataPatch, pageMetadataPatch } from "./notion-client";
import { notionIdToUuid } from "./notion-ids";
import { parseEnvFile } from "./config";
import { mapDatabaseSchema, mapViewDefinition } from "./notion-schema";

describe("notion-ids", () => {
  test("formats 32-hex id as UUID", () => {
    expect(notionIdToUuid("72b6fb455b824b78962b0e509cc091c9")).toBe(
      "72b6fb45-5b82-4b78-962b-0e509cc091c9",
    );
  });
});

describe("config", () => {
  test("parseEnvFile reads key value pairs", () => {
    const env = parseEnvFile("# comment\nNOTION_API_KEY=secret\n\nFOO=bar\n");
    expect(env.NOTION_API_KEY).toBe("secret");
    expect(env.FOO).toBe("bar");
  });
});

describe("pageMetadataPatch", () => {
  test("fills missing timestamp fields", () => {
    const patch = pageMetadataPatch(
      {
        id: "72b6fb45-5b82-4789-a62b-0e509cc091c9",
        created_time: "2024-01-01T00:00:00.000Z",
        last_edited_time: "2024-02-01T00:00:00.000Z",
        url: "https://www.notion.so/Marloth-72b6fb455b824b78962b0e509cc091c9",
      },
      {},
      false,
    );
    expect(patch.created_at).toBe("2024-01-01T00:00:00.000Z");
    expect(patch.modified_at).toBe("2024-02-01T00:00:00.000Z");
    expect(patch.notion_url).toContain("notion.so");
  });

  test("skips existing fields unless force", () => {
    const patch = pageMetadataPatch(
      {
        id: "x",
        created_time: "2024-01-01T00:00:00.000Z",
        last_edited_time: "2024-02-01T00:00:00.000Z",
      },
      { created_at: "2023-01-01T00:00:00.000Z" },
      false,
    );
    expect(patch.created_at).toBeUndefined();
    expect(patch.modified_at).toBe("2024-02-01T00:00:00.000Z");
  });
});

describe("databaseMetadataPatch", () => {
  test("fills missing timestamp fields from database response", () => {
    const patch = databaseMetadataPatch(
      {
        id: "db",
        properties: {},
        created_time: "2024-03-01T00:00:00.000Z",
        last_edited_time: "2024-04-01T00:00:00.000Z",
        url: "https://www.notion.so/dd0de9867cc345b898929306bdf9fc83",
      },
      {},
      false,
    );
    expect(patch.created_at).toBe("2024-03-01T00:00:00.000Z");
    expect(patch.modified_at).toBe("2024-04-01T00:00:00.000Z");
    expect(patch.notion_url).toContain("notion.so");
  });
});

describe("notion-schema mapping", () => {
  test("mapDatabaseSchema extracts property types", () => {
    const schema = mapDatabaseSchema({
      id: "db",
      properties: {
        Status: { id: "abc", type: "select", select: { options: [{ name: "Done" }] } },
        Name: { id: "title", type: "title", title: {} },
      },
    });
    expect(schema.properties.Status?.type).toBe("select");
    expect(schema.properties.Name?.type).toBe("title");
  });

  test("mapViewDefinition extracts visible columns", () => {
    const view = mapViewDefinition({
      id: "view1",
      name: "Active",
      type: "table",
      filter: { property: "Status", select: { equals: "Done" } },
      sorts: [{ property: "Name", direction: "ascending" }],
      format: {
        table_properties: [
          { property_id: "title", visible: true },
          { property_id: "abc", visible: true },
        ],
      },
    });
    expect(view.name).toBe("Active");
    expect(view.visiblePropertyIds).toEqual(["title", "abc"]);
  });
});
