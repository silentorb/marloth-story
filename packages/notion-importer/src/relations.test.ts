import { describe, expect, test } from "bun:test";
import { parseRelationLinks } from "./relations";

describe("parseRelationLinks", () => {
  test("extracts notion ids from relation lists", () => {
    const val =
      "Part 1 (../Parts%20test/Part%201%20dbdd3ba02f5d4fa2b469fa674b5a0b93.csv), Part 2 (../Parts%20test/Part%202%200c0f5dc9289549968753fa24d3494c8d.csv)";
    const links = parseRelationLinks(val);
    expect(links.length).toBe(2);
    expect(links[0]!.notionId).toBe("dbdd3ba02f5d4fa2b469fa674b5a0b93");
    expect(links[1]!.notionId).toBe("0c0f5dc9289549968753fa24d3494c8d");
  });
});
