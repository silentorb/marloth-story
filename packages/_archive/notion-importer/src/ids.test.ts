import { describe, expect, test } from "bun:test";
import { extractNotionId } from "./ids";

describe("extractNotionId", () => {
  test("extracts id from md filename", () => {
    expect(
      extractNotionId("Part 1 2ba58e628ba280049017e661741a929b.md"),
    ).toBe("2ba58e628ba280049017e661741a929b");
  });

  test("returns null when missing", () => {
    expect(extractNotionId("no-id-here.md")).toBeNull();
  });
});
