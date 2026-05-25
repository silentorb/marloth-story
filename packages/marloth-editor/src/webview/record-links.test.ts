import { describe, expect, test } from "bun:test";
import { resolveRecordLinkTarget, standaloneViewUrl } from "./record-links";
import { marlothHref } from "../shared/types";

describe("record-links", () => {
  test("resolveRecordLinkTarget accepts marloth and legacy notion hrefs", () => {
    const id = "72b6fb455b824b78962b0e509cc091c9";
    expect(resolveRecordLinkTarget(marlothHref(id))).toBe(id);
    expect(resolveRecordLinkTarget("Marloth/Page%20abc.md")).toBeNull();
  });

  test("standaloneViewUrl maps app views to query params", () => {
    expect(standaloneViewUrl("graph-overview", null, "http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/?view=overview",
    );
    expect(
      standaloneViewUrl("record", "72b6fb455b824b78962b0e509cc091c9", "http://127.0.0.1:5173/"),
    ).toBe("http://127.0.0.1:5173/?record=72b6fb455b824b78962b0e509cc091c9");
  });
});
