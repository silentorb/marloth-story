import { describe, expect, test } from "bun:test";
import { resolveRecordLinkTarget, standaloneViewUrl } from "./record-links";
import { marlothHref } from "../shared/types";

describe("record-links", () => {
  test("resolveRecordLinkTarget accepts marloth and legacy notion hrefs", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(resolveRecordLinkTarget(marlothHref(id))).toBe(id);
    expect(resolveRecordLinkTarget("Marloth/Page%20abc.md")).toBeNull();
    expect(resolveRecordLinkTarget("Marloth/Features%20dd0de9867cc345b898929306bdf9fc83.csv")).toBe(
      "dd0de9867cc345b898929306bdf9fc83",
    );
    expect(resolveRecordLinkTarget("Marloth/TWOLD%20design%2013458e628ba28073850dea0edb9acde1.md")).toBe(
      "13458e628ba28073850dea0edb9acde1",
    );
  });

  test("standaloneViewUrl maps app views to query params", () => {
    expect(standaloneViewUrl("graph-explorer", null, "http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/?view=explorer&anchor=e028aa0786f5449984a4f497c1d746fa",
    );
    expect(
      standaloneViewUrl("record", "72b6fb455b824b78962b0e509cc091c9", "http://127.0.0.1:5173/"),
    ).toBe("http://127.0.0.1:5173/?record=72b6fb455b824b78962b0e509cc091c9");
  });
});
