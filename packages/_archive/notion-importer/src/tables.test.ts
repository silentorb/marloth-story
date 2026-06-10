import { describe, expect, test } from "bun:test";
import { gfmTable } from "./tables";

describe("gfmTable", () => {
  test("builds table with escaped pipes", () => {
    const out = gfmTable(["A", "B"], [["x|y", "z"]]);
    expect(out).toContain("x\\|y");
    expect(out).toContain("| --- |");
  });
});
