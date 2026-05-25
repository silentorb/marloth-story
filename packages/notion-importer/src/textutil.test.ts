import { describe, expect, test } from "bun:test";
import {
  convertNotionAsidesToBlockquotes,
  formatCalloutContentLines,
  normalizeCalloutBlockquotes,
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

  test("convertNotionAsidesToBlockquotes converts aside blocks", () => {
    const input = [
      "Intro",
      "",
      "<aside>",
      "💡",
      "",
      "There could be two Manors…",
      "",
      "</aside>",
      "",
      "<aside>",
      "💡 One-line note",
      "</aside>",
    ].join("\n");
    expect(convertNotionAsidesToBlockquotes(input)).toBe(
      [
        "Intro",
        "",
        "> 💡 There could be two Manors…",
        "",
        "> 💡 One-line note",
      ].join("\n"),
    );
  });

  test("convertNotionAsidesToBlockquotes handles nested asides", () => {
    const input = [
      "<aside>",
      "💡",
      "",
      "Outer note",
      "",
      "<aside>",
      "💡",
      "",
      "Inner note",
      "",
      "</aside>",
      "",
      "</aside>",
    ].join("\n");
    expect(convertNotionAsidesToBlockquotes(input)).toBe(
      "> 💡 Outer note\n> > 💡 Inner note",
    );
  });

  test("normalizeCalloutBlockquotes merges split emoji lines", () => {
    const input = [
      "> 💡",
      ">",
      "> There could be two Manors…",
      "",
      "> 💡 The character is inspired by Lan.",
    ].join("\n");
    expect(normalizeCalloutBlockquotes(input)).toBe(
      [
        "> 💡 There could be two Manors…",
        "",
        "> 💡 The character is inspired by Lan.",
      ].join("\n"),
    );
  });

  test("formatCalloutContentLines merges emoji with following text", () => {
    expect(formatCalloutContentLines(["💡", "", "There could be two Manors…"])).toEqual([
      "💡 There could be two Manors…",
    ]);
    expect(formatCalloutContentLines(["💡 One-line note"])).toEqual(["💡 One-line note"]);
  });
});
