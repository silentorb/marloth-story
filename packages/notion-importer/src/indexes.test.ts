import { describe, expect, test } from "bun:test";
import { indexOutFilename, parseCsvBasename } from "./indexes";

describe("indexes", () => {
  test("parseCsvBasename default view", () => {
    const p = parseCsvBasename("Scenes abfe0d182a81472eab8610e7c73717d0.csv");
    expect(p?.databaseId).toBe("abfe0d182a81472eab8610e7c73717d0");
    expect(p?.viewKey).toBe("default");
  });

  test("parseCsvBasename all view", () => {
    const p = parseCsvBasename(
      "Scenes test abfe0d182a81472eab8610e7c73717d0_all.csv",
    );
    expect(p?.viewKey).toBe("all");
    expect(indexOutFilename(p!.databaseId, p!.viewKey)).toBe(
      "index-abfe0d182a81472eab8610e7c73717d0-all.md",
    );
  });
});
