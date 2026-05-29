import { describe, expect, test } from "bun:test";
import {
  formatMarlothLink,
  marlothHref,
  nodeIdFromHref,
  nodeIdFromUri,
  resolveLinkTarget,
  standaloneNodeUrl,
} from "./types";

describe("link helpers", () => {
  test("marloth href round-trip", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(nodeIdFromHref(marlothHref(id))).toBe(id);
    expect(formatMarlothLink("Marloth", id)).toBe(`[Marloth](marloth:${id})`);
  });

  test("node uri parsing", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(nodeIdFromUri(`marloth://node/${id}`)).toBe(id);
  });

  test("resolves legacy notion export paths", () => {
    const href = "Marloth/TWOLD%20design%2013458e628ba28073850dea0edb9acde1.md";
    expect(resolveLinkTarget(href)).toBe("13458e628ba28073850dea0edb9acde1");
  });

  test("builds standalone browser node urls", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(standaloneNodeUrl(id, "http://127.0.0.1:5173/?view=overview")).toBe(
      "http://127.0.0.1:5173/?node=72b6fb455b824b78962b0e509cc091c9",
    );
    expect(standaloneNodeUrl(id, "http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/?node=72b6fb455b824b78962b0e509cc091c9",
    );
  });
});
