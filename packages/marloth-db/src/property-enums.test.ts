import { describe, expect, test } from "bun:test";
import type { SchemaFile } from "./schema-rules/schema-file";
import {
  getPriorityOptions,
  coalescePriorityValue,
  enrichColumnDef,
  isPriorityValue,
  priorityWeight,
  resolvePriorityEnum,
} from "./property-enums";

const TEST_SCHEMA: SchemaFile = {
  version: 1,
  relationshipRules: [],
  enums: {
    priority: {
      options: ["Low", "Medium", "High", "Consideration"],
      default: "Low",
      values: {
        Low: 1,
        Medium: 2,
        High: 4,
        Consideration: 0,
      },
    },
  },
};

describe("property-enums", () => {
  test("priorityWeight maps labels to weights from schema values", () => {
    expect(priorityWeight("High")).toBe(4);
    expect(priorityWeight("Medium")).toBe(2);
    expect(priorityWeight("Consideration")).toBe(0);
    expect(priorityWeight("")).toBe(1);
    expect(priorityWeight("unknown")).toBe(0);
  });

  test("coalescePriorityValue defaults unset to Low", () => {
    expect(coalescePriorityValue("")).toBe("Low");
    expect(coalescePriorityValue(undefined)).toBe("Low");
    expect(coalescePriorityValue("High")).toBe("High");
  });

  test("isPriorityValue accepts canonical options only", () => {
    expect(isPriorityValue("High")).toBe(true);
    expect(isPriorityValue("Ultimate")).toBe(false);
    expect(isPriorityValue("4")).toBe(false);
  });

  test("resolvePriorityEnum reads inline schema", () => {
    const def = resolvePriorityEnum(TEST_SCHEMA);
    expect(def.options).toEqual(["Low", "Medium", "High", "Consideration"]);
    expect(def.default).toBe("Low");
    expect(def.values?.High).toBe(4);
  });

  test("enrichColumnDef adds enum metadata for priority columns", () => {
    const enriched = enrichColumnDef(
      { key: "priority", name: "Priority", type: "select" },
      TEST_SCHEMA,
    );
    expect(enriched.type).toBe("enum");
    expect(enriched.enumId).toBe("priority");
    expect(enriched.options).toEqual([...getPriorityOptions()]);
    expect(enriched.defaultValue).toBe("Low");
  });
});
