import { describe, expect, test } from "bun:test";
import {
  slugifyKey,
  stripEmojis,
  urlFriendlyBasename,
} from "./textutil";

describe("textutil", () => {
  test("stripEmojis removes common emoji", () => {
    expect(stripEmojis("📌 Order")).toBe("Order");
  });

  test("slugifyKey handles reserved keys", () => {
    expect(slugifyKey("Title")).toBe("prop_title");
  });

  test("urlFriendlyBasename slugifies title", () => {
    expect(
      urlFriendlyBasename("Part 1 2ba58e628ba280049017e661741a929b.md"),
    ).toBe("part-1-2ba58e628ba280049017e661741a929b.md");
  });
});
