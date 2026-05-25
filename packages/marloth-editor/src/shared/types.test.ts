import { describe, expect, test } from "bun:test";
import {
  formatMarlothLink,
  marlothHref,
  recordIdFromHref,
  recordIdFromUri,
  resolveLinkTarget,
} from "./types";

describe("link helpers", () => {
  test("marloth href round-trip", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(recordIdFromHref(marlothHref(id))).toBe(id);
    expect(formatMarlothLink("Marloth", id)).toBe(`[Marloth](marloth:${id})`);
  });

  test("record uri parsing", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(recordIdFromUri(`marloth://record/${id}`)).toBe(id);
  });

  test("resolves legacy notion export paths", () => {
    const href = "Marloth/TWOLD%20design%2013458e628ba28073850dea0edb9acde1.md";
    expect(resolveLinkTarget(href)).toBe("13458e628ba28073850dea0edb9acde1");
  });
});
