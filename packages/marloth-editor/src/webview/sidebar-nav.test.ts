import { describe, expect, test } from "bun:test";
import { SIDEBAR_NODE_LINKS } from "./sidebar-nav";

describe("sidebar-nav", () => {
  test("record links use distinct ids and labels", () => {
    const ids = SIDEBAR_NODE_LINKS.map((link) => link.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SIDEBAR_NODE_LINKS.map((link) => link.label)).toEqual([
      "Features",
      "Solutions",
      "Scenes",
      "Inspirations",
      "Articles",
      "Characters",
      "Locations",
    ]);
  });

  test("Inspirations links to the database, not the parent page", () => {
    const inspirations = SIDEBAR_NODE_LINKS.find((link) => link.label === "Inspirations");
    expect(inspirations?.id).toBe("2eea538996934ce8abafc27132e576c1");
    expect(inspirations?.id).not.toBe("f8c501a697f94792a07c4c1bb7760d15");
  });
});
