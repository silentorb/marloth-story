import { describe, expect, test } from "bun:test";
import {
  PRIORITY_OPTIONS,
  coalescePriorityValue,
  enrichColumnDef,
  isPriorityValue,
  priorityWeight,
} from "./property-enums";

describe("property-enums", () => {
  test("priorityWeight maps labels to weights, not stored values", () => {
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
    expect(isPriorityValue("Ultimate")).toBe(true);
    expect(isPriorityValue("4")).toBe(false);
  });

  test("enrichColumnDef adds enum metadata for priority columns", () => {
    const enriched = enrichColumnDef({ key: "priority", name: "Priority", type: "select" });
    expect(enriched.type).toBe("enum");
    expect(enriched.enumId).toBe("priority");
    expect(enriched.options).toEqual([...PRIORITY_OPTIONS]);
    expect(enriched.defaultValue).toBe("Low");
  });
});
