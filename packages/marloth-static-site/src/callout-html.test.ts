import { describe, expect, test } from "bun:test";
import { decorateCalloutHtml } from "./lib/callout-html";

describe("decorateCalloutHtml", () => {
  test("adds marloth-callout class when first paragraph has leading emoji", () => {
    const html = "<blockquote><p>💡 Important note</p></blockquote>";
    expect(decorateCalloutHtml(html)).toBe(
      '<blockquote class="marloth-callout"><p>💡 Important note</p></blockquote>',
    );
  });

  test("leaves plain quotes unchanged", () => {
    const html = "<blockquote><p>Someone said this.</p></blockquote>";
    expect(decorateCalloutHtml(html)).toBe(html);
  });

  test("tags nested callout blockquotes independently", () => {
    const html =
      "<blockquote><p>💡 Outer</p><blockquote><p>💡 Inner</p></blockquote></blockquote>";
    expect(decorateCalloutHtml(html)).toBe(
      '<blockquote class="marloth-callout"><p>💡 Outer</p><blockquote class="marloth-callout"><p>💡 Inner</p></blockquote></blockquote>',
    );
  });
});
