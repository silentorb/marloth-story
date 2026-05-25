import { describe, expect, test } from "bun:test";
import { buildTargetToOutput, rewriteAllLinks } from "./links";

describe("links", () => {
  test("buildTargetToOutput maps ids", () => {
    const [byResolved, idTo] = buildTargetToOutput(
      ["external/notion/Foo 0123456789abcdef0123456789abcdef.md"],
      "/repo",
    );
    expect(Object.keys(byResolved).length).toBe(1);
    expect(idTo["0123456789abcdef0123456789abcdef"]).toBe(
      "foo-0123456789abcdef0123456789abcdef.md",
    );
  });

  test("rewriteAllLinks resolves notion paren links", () => {
    const sources = [
      "external/notion/A 0123456789abcdef0123456789abcdef.md",
      "external/notion/B fedcba9876543210fedcba9876543210.md",
    ];
    const [byResolved, idTo] = buildTargetToOutput(sources, "/repo");
    const text =
      "See [A](A 0123456789abcdef0123456789abcdef.md) for details.";
    const [out, errs] = rewriteAllLinks(
      text,
      sources[1]!,
      "/repo",
      byResolved,
      idTo,
    );
    expect(errs).toEqual([]);
    expect(out).toContain("[A](a-0123456789abcdef0123456789abcdef.md)");
  });
});
