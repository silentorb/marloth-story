import { describe, expect, test } from "bun:test";
import { preprocessStandaloneMarkdown } from "./standalone-markdown";

describe("preprocessStandaloneMarkdown", () => {
  test("rewrites notion export links to standalone record URLs", () => {
    const body = "See [Cozy horror](Cozy%20horror%20e5cc80dc61ed4c629951cdf472b20b7a.md).";
    const out = preprocessStandaloneMarkdown(body, "http://127.0.0.1:5173/?record=abc");
    expect(out).toContain("?record=e5cc80dc61ed4c629951cdf472b20b7a");
    expect(out).not.toContain("Cozy%20horror");
  });

  test("leaves non-record links unchanged", () => {
    const body = "See [Example](https://example.com).";
    expect(preprocessStandaloneMarkdown(body)).toBe(body);
  });
});
