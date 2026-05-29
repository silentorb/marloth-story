import { describe, expect, test } from "bun:test";
import {
  metadataExpandedFromLocation,
  resolveNodeLinkTarget,
  standaloneViewUrl,
  syncMetadataExpandedParam,
} from "./node-links";
import { marlothHref, standaloneNodeUrl } from "../shared/types";

describe("node-links", () => {
  test("resolveNodeLinkTarget accepts marloth and legacy notion hrefs", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(resolveNodeLinkTarget(marlothHref(id))).toBe(id);
    expect(resolveNodeLinkTarget("Marloth/Page%20abc.md")).toBeNull();
    expect(resolveNodeLinkTarget("Marloth/Features%20dd0de9867cc345b898929306bdf9fc83.csv")).toBe(
      "dd0de9867cc345b898929306bdf9fc83",
    );
    expect(resolveNodeLinkTarget("Marloth/TWOLD%20design%2013458e628ba28073850dea0edb9acde1.md")).toBe(
      "13458e628ba28073850dea0edb9acde1",
    );
  });

  test("standaloneViewUrl maps app views to query params", () => {
    expect(standaloneViewUrl("graph-explorer", null, "http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/?view=explorer&anchor=e028aa0786f5449984a4f497c1d746fa",
    );
    expect(
      standaloneViewUrl("node-page", "72b6fb455b824b78962b0e509cc091c9", "http://127.0.0.1:5173/"),
    ).toBe("http://127.0.0.1:5173/?node=72b6fb455b824b78962b0e509cc091c9");
  });

  test("metadataExpandedFromLocation reads meta query param", () => {
    const original = window.location.href;
    window.history.replaceState({}, "", "http://127.0.0.1:5173/?node=aaa&meta=1");
    expect(metadataExpandedFromLocation()).toBe(true);
    syncMetadataExpandedParam(false);
    expect(metadataExpandedFromLocation()).toBe(false);
    window.history.replaceState({}, "", original);
  });

  test("standaloneNodeUrl strips meta param", () => {
    expect(
      standaloneNodeUrl("72b6fb455b824b78962b0e509cc091c9", "http://127.0.0.1:5173/?meta=1"),
    ).toBe("http://127.0.0.1:5173/?node=72b6fb455b824b78962b0e509cc091c9");
  });
});
