import { describe, expect, test } from "bun:test";
import { relationLabel, stripEmojis } from "./relation-label";

describe("relation-label", () => {
  test("stripEmojis removes leading symbols", () => {
    expect(stripEmojis("☑️ Features")).toBe("Features");
  });

  test("relationLabel maps property names to graph edge labels", () => {
    expect(relationLabel("Bible passages")).toBe("BIBLE_PASSAGES");
    expect(relationLabel("Parents")).toBe("PARENTS");
    expect(relationLabel("☑️ Features")).toBe("FEATURES");
  });
});
